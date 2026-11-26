#include "CourseContent.h"

#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/FileManager.h"

namespace
{
	TSharedPtr<FJsonValue> ReadJsonFile(const FString& Path, TArray<FString>& Errors)
	{
		FString Text;
		if (!FFileHelper::LoadFileToString(Text, *Path))
		{
			Errors.Add(FString::Printf(TEXT("No pude leer %s"), *Path));
			return nullptr;
		}
		TSharedPtr<FJsonValue> Root;
		const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Text);
		if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
		{
			Errors.Add(FString::Printf(TEXT("JSON inválido en %s: %s"), *FPaths::GetCleanFilename(Path), *Reader->GetErrorMessage()));
			return nullptr;
		}
		return Root;
	}

	FString Str(const TSharedPtr<FJsonObject>& O, const TCHAR* Key, const FString& Def = FString())
	{
		FString V;
		return (O.IsValid() && O->TryGetStringField(Key, V)) ? V : Def;
	}

	double Num(const TSharedPtr<FJsonObject>& O, const TCHAR* Key, double Def = 0)
	{
		double V;
		return (O.IsValid() && O->TryGetNumberField(Key, V)) ? V : Def;
	}

	bool Bool(const TSharedPtr<FJsonObject>& O, const TCHAR* Key, bool Def = false)
	{
		bool V;
		return (O.IsValid() && O->TryGetBoolField(Key, V)) ? V : Def;
	}

	TArray<FString> StrArray(const TSharedPtr<FJsonObject>& O, const TCHAR* Key)
	{
		TArray<FString> Out;
		const TArray<TSharedPtr<FJsonValue>>* Arr;
		if (O.IsValid() && O->TryGetArrayField(Key, Arr))
		{
			for (const TSharedPtr<FJsonValue>& V : *Arr)
			{
				FString S;
				if (V.IsValid() && V->TryGetString(S)) Out.Add(S);
			}
		}
		return Out;
	}

	const TArray<TSharedPtr<FJsonValue>>* Arr(const TSharedPtr<FJsonObject>& O, const TCHAR* Key)
	{
		const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
		if (O.IsValid() && O->TryGetArrayField(Key, A)) return A;
		return nullptr;
	}

	// Un archivo puede ser un arreglo de objetos o un objeto con la lista en "Key"
	TArray<TSharedPtr<FJsonObject>> ObjectsOf(const TSharedPtr<FJsonValue>& Root, const TCHAR* Key)
	{
		TArray<TSharedPtr<FJsonObject>> Out;
		if (!Root.IsValid()) return Out;
		const TArray<TSharedPtr<FJsonValue>>* A = nullptr;
		if (Root->Type == EJson::Array) A = &Root->AsArray();
		else if (Root->Type == EJson::Object) A = Arr(Root->AsObject(), Key);
		if (A)
		{
			for (const TSharedPtr<FJsonValue>& V : *A)
				if (V.IsValid() && V->Type == EJson::Object) Out.Add(V->AsObject());
		}
		return Out;
	}

	TArray<FString> JsonFilesIn(const FString& Dir)
	{
		TArray<FString> Files;
		IFileManager::Get().FindFiles(Files, *(Dir / TEXT("*.json")), true, false);
		Files.Sort();
		for (FString& F : Files) F = Dir / F;
		return Files;
	}

	FExamQuestion ParseQuestion(const TSharedPtr<FJsonObject>& Q, const FString& Id)
	{
		FExamQuestion Out;
		Out.Id = Id;
		Out.Type = Str(Q, TEXT("type"), TEXT("mc"));
		Out.Q = Str(Q, TEXT("q"));
		Out.Explain = Str(Q, TEXT("explain"));
		Out.Section = Str(Q, TEXT("section"));
		if (Out.Type == TEXT("tf"))
		{
			Out.Options = { TEXT("Verdadero"), TEXT("Falso") };
			Out.Correct = Bool(Q, TEXT("answer"), true) ? 0 : 1;
		}
		else
		{
			Out.Options = StrArray(Q, TEXT("options"));
			Out.Correct = FMath::Clamp((int32)Num(Q, TEXT("correct"), 0), 0, FMath::Max(0, Out.Options.Num() - 1));
		}
		return Out;
	}

	FCourseExam ParseExam(const TArray<TSharedPtr<FJsonValue>>* Questions, const FString& Id, const FString& Title, int32 Pass)
	{
		FCourseExam E;
		E.Id = Id;
		E.Title = Title;
		E.PassScore = Pass;
		if (Questions)
		{
			int32 N = 0;
			for (const TSharedPtr<FJsonValue>& V : *Questions)
			{
				if (V.IsValid() && V->Type == EJson::Object)
					E.Questions.Add(ParseQuestion(V->AsObject(), FString::Printf(TEXT("%s-q%d"), *Id, N)));
				++N;
			}
		}
		return E;
	}

	EMissionTask TaskKind(const FString& K)
	{
		if (K == TEXT("goto")) return EMissionTask::GoTo;
		if (K == TEXT("lesson")) return EMissionTask::Lesson;
		if (K == TEXT("practice")) return EMissionTask::Practice;
		if (K == TEXT("maintenance")) return EMissionTask::Maintenance;
		if (K == TEXT("exam")) return EMissionTask::Exam;
		if (K == TEXT("program")) return EMissionTask::Program;
		if (K == TEXT("quiz")) return EMissionTask::Quiz;
		return EMissionTask::Talk;
	}
}

FLinearColor AcademiaColor::FromHex(const FString& Hex, const FLinearColor& Fallback)
{
	if (Hex.IsEmpty()) return Fallback;
	FString H = Hex;
	H.RemoveFromStart(TEXT("#"));
	if (H.Len() != 6 && H.Len() != 8) return Fallback;
	return FLinearColor::FromSRGBColor(FColor::FromHex(H));
}

FString FCourseContent::ResolveContentDir()
{
	const FString Candidates[] = {
		FPaths::ProjectContentDir() / TEXT("CursoData"),
		FPaths::ProjectDir() / TEXT("../../content"),
		FPaths::LaunchDir() / TEXT("CursoData"),
	};
	for (const FString& C : Candidates)
	{
		FString Full = FPaths::ConvertRelativePathToFull(C);
		FPaths::NormalizeDirectoryName(Full);
		if (FPaths::FileExists(Full / TEXT("machines.json"))) return Full;
	}
	return FPaths::ConvertRelativePathToFull(Candidates[0]);
}

bool FCourseContent::Load(const FString& Dir)
{
	*this = FCourseContent();
	RootDir = Dir;

	// --- Máquinas ---
	for (const TSharedPtr<FJsonObject>& M : ObjectsOf(ReadJsonFile(Dir / TEXT("machines.json"), Errors), TEXT("machines")))
	{
		FCourseMachine CM;
		CM.Id = Str(M, TEXT("id"));
		CM.Name = Str(M, TEXT("name"), CM.Id);
		CM.Brand = Str(M, TEXT("brand"));
		CM.Model = Str(M, TEXT("model"), TEXT("generic"));
		CM.Description = Str(M, TEXT("description"));
		CM.Color = AcademiaColor::FromHex(Str(M, TEXT("color")), CM.Color);
		if (!CM.Id.IsEmpty()) Machines.Add(CM);
	}

	// --- Módulos ---
	for (const FString& File : JsonFilesIn(Dir / TEXT("modules")))
	{
		const TSharedPtr<FJsonValue> Root = ReadJsonFile(File, Errors);
		if (!Root.IsValid() || Root->Type != EJson::Object) continue;
		const TSharedPtr<FJsonObject> O = Root->AsObject();
		FCourseModule M;
		M.Id = Str(O, TEXT("id"), FPaths::GetBaseFilename(File));
		M.Brand = Str(O, TEXT("brand"));
		M.Machine = Str(O, TEXT("machine"));
		if (M.Machine.IsEmpty())
		{
			// Módulos sin máquina: se deduce por la marca (ks = Keysight ICT, spi = SPI, gen = fundamentos)
			static const TMap<FString, FString> ByBrand = { { TEXT("ky"), TEXT("aoi_ky") }, { TEXT("v5"), TEXT("aoi_v510") }, { TEXT("v8"), TEXT("axi_v810") }, { TEXT("ks"), TEXT("ict") }, { TEXT("spi"), TEXT("spi") } };
			const FString* Found = ByBrand.Find(M.Brand);
			M.Machine = Found ? *Found : FString(TEXT("general"));
		}
		M.Title = Str(O, TEXT("title"), M.Id);
		M.Summary = Str(O, TEXT("summary"));
		M.Order = (int32)Num(O, TEXT("order"), Modules.Num());
		if (const TArray<TSharedPtr<FJsonValue>>* Lessons = Arr(O, TEXT("lessons")))
		{
			for (const TSharedPtr<FJsonValue>& LV : *Lessons)
			{
				if (!LV.IsValid() || LV->Type != EJson::Object) continue;
				const TSharedPtr<FJsonObject> L = LV->AsObject();
				FCourseLesson CL;
				CL.Id = Str(L, TEXT("id"), FString::Printf(TEXT("%s-l%d"), *M.Id, M.Lessons.Num() + 1));
				CL.Title = Str(L, TEXT("title"));
				CL.Animation = Str(L, TEXT("animation"));
				CL.KeyPoints = StrArray(L, TEXT("keyPoints"));
				if (const TArray<TSharedPtr<FJsonValue>>* Blocks = Arr(L, TEXT("blocks")))
				{
					for (const TSharedPtr<FJsonValue>& BV : *Blocks)
					{
						if (!BV.IsValid() || BV->Type != EJson::Object) continue;
						const TSharedPtr<FJsonObject> B = BV->AsObject();
						FLessonBlock LB;
						LB.Kind = Str(B, TEXT("kind"), TEXT("text"));
						LB.Text = Str(B, TEXT("text"));
						LB.Items = StrArray(B, TEXT("items"));
						CL.Blocks.Add(LB);
					}
				}
				M.Lessons.Add(CL);
			}
		}
		M.Exam = ParseExam(Arr(O, TEXT("exam")), M.Id, FString::Printf(TEXT("Examen: %s"), *M.Title), 70);
		Modules.Add(M);
	}
	Modules.StableSort([](const FCourseModule& A, const FCourseModule& B) { return A.Order < B.Order; });

	// --- Examen final ---
	{
		const TSharedPtr<FJsonValue> Root = ReadJsonFile(Dir / TEXT("final_exam.json"), Errors);
		if (Root.IsValid() && Root->Type == EJson::Object)
		{
			const TSharedPtr<FJsonObject> O = Root->AsObject();
			FinalExam = ParseExam(Arr(O, TEXT("questions")), TEXT("final"), Str(O, TEXT("title"), TEXT("Examen final")), (int32)Num(O, TEXT("passScore"), 70));
		}
	}

	// --- Mantenimiento ---
	for (const FString& File : JsonFilesIn(Dir / TEXT("maintenance")))
	{
		for (const TSharedPtr<FJsonObject>& P : ObjectsOf(ReadJsonFile(File, Errors), TEXT("procedures")))
		{
			FMaintProc MP;
			MP.Id = Str(P, TEXT("id"));
			MP.Machine = Str(P, TEXT("machine"));
			MP.Title = Str(P, TEXT("title"));
			MP.Frequency = Str(P, TEXT("frequency"));
			MP.Safety = StrArray(P, TEXT("safety"));
			if (const TArray<TSharedPtr<FJsonValue>>* Steps = Arr(P, TEXT("steps")))
			{
				for (const TSharedPtr<FJsonValue>& SV : *Steps)
				{
					if (!SV.IsValid() || SV->Type != EJson::Object) continue;
					const TSharedPtr<FJsonObject> S = SV->AsObject();
					MP.Steps.Add({ Str(S, TEXT("part")), Str(S, TEXT("action"), TEXT("inspect")), Str(S, TEXT("text")) });
				}
			}
			if (!MP.Id.IsEmpty()) Maintenance.Add(MP);
		}
	}

	// --- Prácticas ---
	for (const FString& File : JsonFilesIn(Dir / TEXT("practices")))
	{
		for (const TSharedPtr<FJsonObject>& P : ObjectsOf(ReadJsonFile(File, Errors), TEXT("practices")))
		{
			FPractice PR;
			PR.Id = Str(P, TEXT("id"));
			PR.Machine = Str(P, TEXT("machine"));
			PR.Kind = Str(P, TEXT("kind"), TEXT("create"));
			PR.Title = Str(P, TEXT("title"));
			PR.Scenario = Str(P, TEXT("scenario"));
			if (const TArray<TSharedPtr<FJsonValue>>* Steps = Arr(P, TEXT("steps")))
			{
				for (const TSharedPtr<FJsonValue>& SV : *Steps)
				{
					if (!SV.IsValid() || SV->Type != EJson::Object) continue;
					const TSharedPtr<FJsonObject> S = SV->AsObject();
					FPracticeStep St;
					St.Prompt = Str(S, TEXT("prompt"));
					St.Options = StrArray(S, TEXT("options"));
					St.Correct = (int32)Num(S, TEXT("correct"), 0);
					St.Feedback = Str(S, TEXT("feedback"));
					PR.Steps.Add(St);
				}
			}
			if (const TArray<TSharedPtr<FJsonValue>>* Params = Arr(P, TEXT("params")))
			{
				for (const TSharedPtr<FJsonValue>& PV : *Params)
				{
					if (!PV.IsValid() || PV->Type != EJson::Object) continue;
					const TSharedPtr<FJsonObject> Q = PV->AsObject();
					FPracticeParam Pa;
					Pa.Name = Str(Q, TEXT("name"));
					Pa.Unit = Str(Q, TEXT("unit"));
					Pa.Hint = Str(Q, TEXT("hint"));
					Pa.Min = Num(Q, TEXT("min"), 0);
					Pa.Max = Num(Q, TEXT("max"), 100);
					Pa.Start = Num(Q, TEXT("start"), Pa.Min);
					Pa.TargetMin = Num(Q, TEXT("targetMin"), Pa.Min);
					Pa.TargetMax = Num(Q, TEXT("targetMax"), Pa.Max);
					Pa.bLowIsEscape = Str(Q, TEXT("lowEffect")) == TEXT("escape");
					PR.Params.Add(Pa);
				}
			}
			if (!PR.Id.IsEmpty()) Practices.Add(PR);
		}
	}

	// --- Línea SMT a escala real ---
	{
		const TSharedPtr<FJsonValue> Root = ReadJsonFile(Dir / TEXT("line.json"), Errors);
		for (const TSharedPtr<FJsonObject>& S : ObjectsOf(Root, TEXT("stations")))
		{
			FLineStation LS;
			LS.Id = Str(S, TEXT("id"));
			LS.Name = Str(S, TEXT("name"), LS.Id);
			LS.Template = Str(S, TEXT("template"), TEXT("generic"));
			LS.MachineId = Str(S, TEXT("machine"));
			LS.Source = Str(S, TEXT("source"));
			LS.SizeMM = FVector(Num(S, TEXT("width"), 1000), Num(S, TEXT("depth"), 1300), Num(S, TEXT("height"), 1600));
			LS.ConveyorHeightMM = Num(S, TEXT("conveyorHeight"), 900);
			LS.bInline = Bool(S, TEXT("inline"), true);
			LS.bApprox = Bool(S, TEXT("approx"), false);
			LS.OffsetMM = FVector2D(Num(S, TEXT("x"), 0), Num(S, TEXT("y"), 0));
			LS.GapAfterMM = Num(S, TEXT("gapAfter"), 400);
			LS.Color = AcademiaColor::FromHex(Str(S, TEXT("color")), LS.Color);
			const FCourseMachine* CM = FindMachine(LS.MachineId);
			LS.Accent = AcademiaColor::FromHex(Str(S, TEXT("accent")), CM ? CM->Color : LS.Accent);
			if (!LS.Id.IsEmpty()) Line.Add(LS);
		}
	}

	// --- Carrera: misiones y mentor ---
	for (const FString& File : JsonFilesIn(Dir / TEXT("career")))
	{
		const TSharedPtr<FJsonValue> Root = ReadJsonFile(File, Errors);
		if (Root.IsValid() && Root->Type == EJson::Object)
		{
			const TSharedPtr<FJsonObject>* Mentor;
			if (Root->AsObject()->TryGetObjectField(TEXT("mentor"), Mentor))
			{
				MentorName = Str(*Mentor, TEXT("name"), MentorName);
				MentorRole = Str(*Mentor, TEXT("role"), MentorRole);
			}
		}
		for (const TSharedPtr<FJsonObject>& M : ObjectsOf(Root, TEXT("missions")))
		{
			FCareerMission CM;
			CM.Id = Str(M, TEXT("id"));
			CM.Title = Str(M, TEXT("title"));
			CM.Type = Str(M, TEXT("type"), TEXT("induccion"));
			CM.Machine = Str(M, TEXT("machine"), TEXT("general"));
			CM.Brief = Str(M, TEXT("brief"));
			CM.Order = (int32)Num(M, TEXT("order"), Missions.Num());
			CM.MentorIntro = StrArray(M, TEXT("mentorIntro"));
			CM.MentorOutro = StrArray(M, TEXT("mentorOutro"));
			CM.Requires = StrArray(M, TEXT("requires"));
			CM.RewardXP = (int32)Num(M, TEXT("xp"), 150);
			CM.RewardTitle = Str(M, TEXT("rewardTitle"));
			if (const TArray<TSharedPtr<FJsonValue>>* Tasks = Arr(M, TEXT("tasks")))
			{
				int32 N = 0;
				for (const TSharedPtr<FJsonValue>& TV : *Tasks)
				{
					if (!TV.IsValid() || TV->Type != EJson::Object) continue;
					const TSharedPtr<FJsonObject> T = TV->AsObject();
					FMissionTask MT;
					MT.Kind = TaskKind(Str(T, TEXT("kind")));
					MT.Ref = Str(T, TEXT("ref"));
					MT.Machine = Str(T, TEXT("machine"), CM.Machine);
					MT.Mode = Str(T, TEXT("mode"), SoftwareModeFor(MT.Machine));
					MT.Text = Str(T, TEXT("text"));
					if (MT.Kind == EMissionTask::Quiz) MT.Quiz = ParseQuestion(T, FString::Printf(TEXT("%s-t%d"), *CM.Id, N));
					CM.Tasks.Add(MT);
					++N;
				}
			}
			if (!CM.Id.IsEmpty()) Missions.Add(CM);
		}
	}
	Missions.StableSort([](const FCareerMission& A, const FCareerMission& B) { return A.Order < B.Order; });

	// --- Tarjeta de práctica (la primera carpeta de boards/) ---
	{
		TArray<FString> BoardDirs;
		IFileManager::Get().FindFiles(BoardDirs, *(Dir / TEXT("boards/*")), false, true);
		BoardDirs.Sort();
		for (const FString& B : BoardDirs)
		{
			TSharedPtr<FLoadedBoard> LB = MakeShared<FLoadedBoard>();
			if (AcademiaGerber::LoadBoardFromDir(Dir / TEXT("boards") / B, *LB))
			{
				for (const FString& W : LB->Warnings) Errors.Add(FString::Printf(TEXT("Tarjeta %s: %s"), *B, *W));
				Board = LB;
				break;
			}
		}
	}

	// Validación de referencias para que un JSON nuevo con un error no rompa el juego en silencio
	for (const FCareerMission& M : Missions)
	{
		for (const FMissionTask& T : M.Tasks)
		{
			const bool bMissing =
				(T.Kind == EMissionTask::Lesson && !FindLesson(T.Ref)) ||
				(T.Kind == EMissionTask::Practice && !FindPractice(T.Ref)) ||
				(T.Kind == EMissionTask::Maintenance && !FindMaintenance(T.Ref)) ||
				(T.Kind == EMissionTask::Exam && T.Ref != TEXT("final") && !FindModule(T.Ref));
			if (bMissing) Errors.Add(FString::Printf(TEXT("Misión %s: no existe '%s'"), *M.Id, *T.Ref));
		}
	}

	UE_LOG(LogTemp, Log, TEXT("Academia: contenido de %s -> %d máquinas, %d módulos, %d mantenimientos, %d prácticas, %d misiones, %d estaciones, %d avisos"),
		*Dir, Machines.Num(), Modules.Num(), Maintenance.Num(), Practices.Num(), Missions.Num(), Line.Num(), Errors.Num());
	return Machines.Num() > 0;
}

const FCourseMachine* FCourseContent::FindMachine(const FString& Id) const
{
	return Machines.FindByPredicate([&](const FCourseMachine& M) { return M.Id == Id; });
}

const FCourseModule* FCourseContent::FindModule(const FString& Id) const
{
	return Modules.FindByPredicate([&](const FCourseModule& M) { return M.Id == Id; });
}

const FCourseLesson* FCourseContent::FindLesson(const FString& LessonId, const FCourseModule** OutModule) const
{
	for (const FCourseModule& M : Modules)
	{
		for (const FCourseLesson& L : M.Lessons)
		{
			if (L.Id == LessonId)
			{
				if (OutModule) *OutModule = &M;
				return &L;
			}
		}
	}
	return nullptr;
}

const FMaintProc* FCourseContent::FindMaintenance(const FString& Id) const
{
	return Maintenance.FindByPredicate([&](const FMaintProc& M) { return M.Id == Id; });
}

const FPractice* FCourseContent::FindPractice(const FString& Id) const
{
	return Practices.FindByPredicate([&](const FPractice& P) { return P.Id == Id; });
}

const FCareerMission* FCourseContent::FindMission(const FString& Id) const
{
	return Missions.FindByPredicate([&](const FCareerMission& M) { return M.Id == Id; });
}

const FLineStation* FCourseContent::FindStationForMachine(const FString& MachineId) const
{
	return Line.FindByPredicate([&](const FLineStation& S) { return S.MachineId == MachineId; });
}

TArray<const FCourseModule*> FCourseContent::ModulesFor(const FString& MachineId) const
{
	TArray<const FCourseModule*> Out;
	for (const FCourseModule& M : Modules)
		if (M.Machine == MachineId) Out.Add(&M);
	return Out;
}

FString FCourseContent::PartName(const FString& Part)
{
	static const TMap<FString, FString> Names = {
		{ TEXT("door"), TEXT("Puerta / cubierta frontal") }, { TEXT("emergency_stop"), TEXT("Paro de emergencia") },
		{ TEXT("conveyor"), TEXT("Transportador") }, { TEXT("belt"), TEXT("Bandas del transportador") },
		{ TEXT("rail_width"), TEXT("Ajuste de ancho de riel") }, { TEXT("pcb"), TEXT("Tarjeta (PCB)") },
		{ TEXT("camera"), TEXT("Cámara / cabeza de imagen") }, { TEXT("projector"), TEXT("Proyectores") },
		{ TEXT("light_ring"), TEXT("Iluminación (anillo RGB)") }, { TEXT("xray_source"), TEXT("Tubo de rayos X") },
		{ TEXT("detector"), TEXT("Detector de rayos X") }, { TEXT("interlock"), TEXT("Interlocks de seguridad") },
		{ TEXT("fixture"), TEXT("Fixture (cama de agujas)") }, { TEXT("probes"), TEXT("Agujas / probes") },
		{ TEXT("vacuum"), TEXT("Sistema de vacío") }, { TEXT("pneumatic"), TEXT("Neumática (aire)") },
		{ TEXT("filter"), TEXT("Filtros de aire") }, { TEXT("fan"), TEXT("Ventiladores") },
		{ TEXT("tower_light"), TEXT("Torre de luces") }, { TEXT("pc_ups"), TEXT("PC de visión y UPS") },
		{ TEXT("gantry"), TEXT("Gantry / ejes X-Y") }, { TEXT("calibration_target"), TEXT("Placa / blanco de calibración") },
	};
	const FString* N = Names.Find(Part);
	return N ? *N : Part;
}

FString FCourseContent::ActionName(const FString& Action)
{
	static const TMap<FString, FString> Names = {
		{ TEXT("inspect"), TEXT("Inspeccionar") }, { TEXT("clean"), TEXT("Limpiar") }, { TEXT("lubricate"), TEXT("Lubricar") },
		{ TEXT("replace"), TEXT("Reemplazar") }, { TEXT("calibrate"), TEXT("Calibrar") }, { TEXT("toggle"), TEXT("Accionar / bloquear") },
		{ TEXT("measure"), TEXT("Medir") },
	};
	const FString* N = Names.Find(Action);
	return N ? *N : Action;
}

const TArray<FString>& FCourseContent::AllActions()
{
	static const TArray<FString> A = { TEXT("inspect"), TEXT("clean"), TEXT("lubricate"), TEXT("replace"), TEXT("calibrate"), TEXT("toggle"), TEXT("measure") };
	return A;
}

FString FCourseContent::SoftwareModeFor(const FString& MachineId)
{
	if (MachineId == TEXT("spi")) return TEXT("spi");
	if (MachineId == TEXT("axi_v810")) return TEXT("axi");
	if (MachineId == TEXT("ict")) return TEXT("ict");
	return TEXT("aoi");
}
