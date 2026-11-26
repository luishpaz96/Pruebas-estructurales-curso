#include "AcademiaGameInstance.h"

#include "AcademiaSaveGame.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"
#include "Engine/Engine.h"
#include "Misc/DateTime.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonSerializer.h"

const FString UAcademiaGameInstance::SlotName = TEXT("Academia");

UAcademiaGameInstance* UAcademiaGameInstance::Get(const UObject* WorldContext)
{
	if (!WorldContext) return nullptr;
	const UWorld* W = GEngine ? GEngine->GetWorldFromContextObject(WorldContext, EGetWorldErrorMode::ReturnNull) : nullptr;
	return W ? Cast<UAcademiaGameInstance>(W->GetGameInstance()) : nullptr;
}

void UAcademiaGameInstance::Init()
{
	Super::Init();
	ReloadContent();
	Save = Cast<UAcademiaSaveGame>(UGameplayStatics::LoadGameFromSlot(SlotName, 0));
	if (!Save) Save = Cast<UAcademiaSaveGame>(UGameplayStatics::CreateSaveGameObject(UAcademiaSaveGame::StaticClass()));
	Audio = NewObject<UAcademiaAudio>(this);
}

void UAcademiaGameInstance::OnStart()
{
	Super::OnStart();
	if (Audio)
	{
		Audio->Init(GetWorld());
		ApplyAudioSettings();
	}
}

void UAcademiaGameInstance::Shutdown()
{
	SaveProgress();
	if (Audio) Audio->Shutdown();
	Super::Shutdown();
}

void UAcademiaGameInstance::ReloadContent()
{
	const FString Dir = FCourseContent::ResolveContentDir();
	if (!Course.Load(Dir))
	{
		Course.Errors.Insert(FString::Printf(TEXT("No encontré el contenido del curso en %s. Copia la carpeta content/ del repo ahí."), *Dir), 0);
	}
}

void UAcademiaGameInstance::SaveProgress()
{
	if (Save) UGameplayStatics::SaveGameToSlot(Save, SlotName, 0);
	OnProgress.Broadcast();
}

void UAcademiaGameInstance::ResetProgress()
{
	UAcademiaSaveGame* Fresh = Cast<UAcademiaSaveGame>(UGameplayStatics::CreateSaveGameObject(UAcademiaSaveGame::StaticClass()));
	if (Save && Fresh)
	{
		Fresh->bSound = Save->bSound;
		Fresh->bMusic = Save->bMusic;
		Fresh->MusicVolume = Save->MusicVolume;
	}
	Save = Fresh;
	SaveProgress();
	OnMissionChanged.Broadcast(nullptr, false);
}

FString UAcademiaGameInstance::ExportProgress() const
{
	TSharedRef<FJsonObject> O = MakeShared<FJsonObject>();
	if (!Save) return FString();
	O->SetNumberField(TEXT("xp"), Save->XP);
	auto SetToArr = [&](const TCHAR* K, const TSet<FString>& S)
	{
		TArray<TSharedPtr<FJsonValue>> A;
		for (const FString& V : S) A.Add(MakeShared<FJsonValueString>(V));
		O->SetArrayField(K, A);
	};
	auto MapToObj = [&](const TCHAR* K, const TMap<FString, int32>& M)
	{
		TSharedRef<FJsonObject> J = MakeShared<FJsonObject>();
		for (const TPair<FString, int32>& P : M) J->SetNumberField(P.Key, P.Value);
		O->SetObjectField(K, J);
	};
	SetToArr(TEXT("lessons"), Save->Lessons);
	SetToArr(TEXT("maintSafe"), Save->MaintSafe);
	SetToArr(TEXT("programs"), Save->ProgramsReleased);
	SetToArr(TEXT("missions"), Save->MissionsDone);
	MapToObj(TEXT("exams"), Save->ExamBest);
	MapToObj(TEXT("maint"), Save->MaintBest);
	MapToObj(TEXT("prac"), Save->PracticeBest);
	O->SetNumberField(TEXT("bestStreak"), Save->BestStreak);
	FString Out;
	const TSharedRef<TJsonWriter<>> W = TJsonWriterFactory<>::Create(&Out);
	FJsonSerializer::Serialize(O, W);
	return Out;
}

bool UAcademiaGameInstance::ImportProgress(const FString& Json)
{
	TSharedPtr<FJsonObject> O;
	const TSharedRef<TJsonReader<>> R = TJsonReaderFactory<>::Create(Json);
	if (!FJsonSerializer::Deserialize(R, O) || !O.IsValid() || !Save) return false;
	Save->XP = (int32)O->GetNumberField(TEXT("xp"));
	auto ArrToSet = [&](const TCHAR* K, TSet<FString>& S)
	{
		const TArray<TSharedPtr<FJsonValue>>* A;
		if (O->TryGetArrayField(K, A)) { S.Reset(); for (const TSharedPtr<FJsonValue>& V : *A) S.Add(V->AsString()); }
	};
	auto ObjToMap = [&](const TCHAR* K, TMap<FString, int32>& M)
	{
		const TSharedPtr<FJsonObject>* J;
		if (O->TryGetObjectField(K, J)) { M.Reset(); for (const auto& P : (*J)->Values) M.Add(P.Key, (int32)P.Value->AsNumber()); }
	};
	ArrToSet(TEXT("lessons"), Save->Lessons);
	ArrToSet(TEXT("maintSafe"), Save->MaintSafe);
	ArrToSet(TEXT("programs"), Save->ProgramsReleased);
	ArrToSet(TEXT("missions"), Save->MissionsDone);
	ObjToMap(TEXT("exams"), Save->ExamBest);
	ObjToMap(TEXT("maint"), Save->MaintBest);
	ObjToMap(TEXT("prac"), Save->PracticeBest);
	double BS = 0;
	if (O->TryGetNumberField(TEXT("bestStreak"), BS)) Save->BestStreak = (int32)BS;
	SaveProgress();
	return true;
}

// ---------------------------------------------------------------- Gamificación

const TArray<TPair<int32, FString>>& UAcademiaGameInstance::Levels()
{
	static const TArray<TPair<int32, FString>> L = {
		{ 0, TEXT("Técnico de nuevo ingreso") }, { 300, TEXT("Operador") }, { 800, TEXT("Técnico de pruebas") },
		{ 1600, TEXT("Programador") }, { 2800, TEXT("Técnico de debug") }, { 4500, TEXT("Técnico líder") },
		{ 7000, TEXT("Especialista en inspección") }, { 10000, TEXT("Ingeniero de pruebas") }, { 15000, TEXT("Maestro de línea") },
	};
	return L;
}

FAcademiaLevel UAcademiaGameInstance::GetLevel() const
{
	const int32 XP = Save ? Save->XP : 0;
	const TArray<TPair<int32, FString>>& L = Levels();
	int32 I = 0;
	while (I + 1 < L.Num() && XP >= L[I + 1].Key) ++I;
	FAcademiaLevel Out;
	Out.N = I + 1;
	Out.Name = L[I].Value;
	Out.From = L[I].Key;
	Out.To = (I + 1 < L.Num()) ? L[I + 1].Key : L[I].Key;
	Out.Pct = (Out.To > Out.From) ? float(XP - Out.From) / float(Out.To - Out.From) : 1.f;
	return Out;
}

void UAcademiaGameInstance::MarkDay()
{
	if (!Save) return;
	const FString D = FDateTime::Now().ToString(TEXT("%Y-%m-%d"));
	if (!Save->Days.Contains(D))
	{
		Save->Days.Add(D);
		if (Save->Days.Num() > 400) Save->Days.RemoveAt(0);
	}
}

int32 UAcademiaGameInstance::DayStreak() const
{
	if (!Save) return 0;
	int32 N = 0;
	FDateTime D = FDateTime::Now();
	while (Save->Days.Contains(D.ToString(TEXT("%Y-%m-%d"))))
	{
		++N;
		D -= FTimespan::FromDays(1);
	}
	return N;
}

void UAcademiaGameInstance::AddXP(int32 N, const FString& Why)
{
	if (!Save || N == 0) return;
	const int32 Before = GetLevel().N;
	Save->XP += N;
	MarkDay();
	Toast(FString::Printf(TEXT("+%d XP %s"), N, *Why));
	const FAcademiaLevel After = GetLevel();
	if (After.N > Before)
	{
		Sfx(EAcademiaSfx::Level);
		OnCelebrate.Broadcast();
		Toast(FString::Printf(TEXT("¡Subiste a nivel %d! Ahora eres %s."), After.N, *After.Name));
	}
	CheckBadges();
	SaveProgress();
}

void UAcademiaGameInstance::RegisterAnswer(bool bOk, const FString& QuestionId)
{
	if (!Save) return;
	if (bOk)
	{
		Save->Streak++;
		Save->BestStreak = FMath::Max(Save->BestStreak, Save->Streak);
		if (!QuestionId.IsEmpty()) Save->Wrong.Remove(QuestionId);
	}
	else
	{
		Save->Streak = 0;
		if (!QuestionId.IsEmpty()) Save->Wrong.FindOrAdd(QuestionId)++;
	}
	CheckBadges();
	SaveProgress();
}

void UAcademiaGameInstance::CompleteLesson(const FString& LessonId)
{
	if (!Save) return;
	const bool bNew = !Save->Lessons.Contains(LessonId);
	Save->Lessons.Add(LessonId);
	if (bNew) AddXP(40, TEXT("por la lección"));
	NotifyEvent(EAcademiaEvent::LessonDone, LessonId);
	SaveProgress();
}

void UAcademiaGameInstance::RecordExam(const FString& ExamId, int32 Pct)
{
	if (!Save) return;
	const int32 Prev = Save->ExamBest.FindRef(ExamId);
	Save->ExamBest.Add(ExamId, FMath::Max(Prev, Pct));
	if (Pct >= 70 && Prev < 70) AddXP(ExamId == TEXT("final") ? 600 : 150 + (Pct == 100 ? 50 : 0), TEXT("por aprobar el examen"));
	else if (Pct > Prev) AddXP(20, TEXT("por mejorar tu marca"));
	if (Pct >= 70) NotifyEvent(EAcademiaEvent::ExamPassed, ExamId);
	CheckBadges();
	SaveProgress();
}

void UAcademiaGameInstance::RecordMaintenance(const FString& ProcId, int32 Pct, bool bSafe)
{
	if (!Save) return;
	const int32 Prev = Save->MaintBest.FindRef(ProcId);
	Save->MaintBest.Add(ProcId, FMath::Max(Prev, Pct));
	if (bSafe) Save->MaintSafe.Add(ProcId);
	AddXP(Prev ? (Pct > Prev ? 25 : 5) : 60 + Pct, TEXT("por el mantenimiento"));
	if (Pct >= 70) NotifyEvent(EAcademiaEvent::MaintenanceDone, ProcId);
	SaveProgress();
}

void UAcademiaGameInstance::RecordPractice(const FString& PracticeId, int32 Pct)
{
	if (!Save) return;
	const int32 Prev = Save->PracticeBest.FindRef(PracticeId);
	Save->PracticeBest.Add(PracticeId, FMath::Max(Prev, Pct));
	if (!Save->PracticeBest.Contains(PracticeId) || Prev == 0) AddXP(80 + Pct, TEXT("por completar la práctica"));
	else if (Pct > Prev) AddXP(20, TEXT("por mejorar tu marca"));
	if (Pct >= 60) NotifyEvent(EAcademiaEvent::PracticeDone, PracticeId);
	SaveProgress();
}

void UAcademiaGameInstance::RecordProgramReleased(const FString& Mode)
{
	if (!Save) return;
	if (!Save->ProgramsReleased.Contains(Mode))
	{
		Save->ProgramsReleased.Add(Mode);
		AddXP(250, TEXT("por un programa liberado sin escapes"));
	}
	NotifyEvent(EAcademiaEvent::ProgramReleased, Mode);
	SaveProgress();
}

bool UAcademiaGameInstance::IsPassed(const FString& ExamId) const
{
	return Save && Save->ExamBest.FindRef(ExamId) >= 70;
}

float UAcademiaGameInstance::ModuleProgress(const FCourseModule& M) const
{
	if (!Save) return 0.f;
	const int32 Total = M.Lessons.Num() + 1;
	int32 Done = IsPassed(M.Id) ? 1 : 0;
	for (const FCourseLesson& L : M.Lessons) if (Save->Lessons.Contains(L.Id)) ++Done;
	return float(Done) / float(Total);
}

float UAcademiaGameInstance::MachineProgress(const FString& MachineId) const
{
	const TArray<const FCourseModule*> Ms = Course.ModulesFor(MachineId);
	if (Ms.Num() == 0) return 0.f;
	float Sum = 0.f;
	for (const FCourseModule* M : Ms) Sum += ModuleProgress(*M);
	return Sum / Ms.Num();
}

bool UAcademiaGameInstance::IsUnlocked(const FCourseModule& M) const
{
	if (!Save || Save->bFreeMode) return true;
	const TArray<const FCourseModule*> Ms = Course.ModulesFor(M.Machine);
	const int32 I = Ms.IndexOfByKey(&M);
	if (I <= 0) return true;
	const FCourseModule* Prev = Ms[I - 1];
	if (IsPassed(Prev->Id)) return true;
	for (const FCourseLesson& L : Prev->Lessons) if (!Save->Lessons.Contains(L.Id)) return false;
	return Prev->Lessons.Num() > 0;
}

TArray<FAcademiaBadge> UAcademiaGameInstance::GetBadges() const
{
	TArray<FAcademiaBadge> Out;
	if (!Save) return Out;
	int32 TotalLessons = 0;
	for (const FCourseModule& M : Course.Modules) TotalLessons += M.Lessons.Num();
	bool bAnyPass = false, bPerfect = false;
	for (const TPair<FString, int32>& E : Save->ExamBest) { bAnyPass |= E.Value >= 70; bPerfect |= E.Value == 100; }
	bool bMaintPerfect = false;
	for (const TPair<FString, int32>& E : Save->MaintBest) bMaintPerfect |= E.Value == 100;
	int32 Debugs = 0;
	for (const TPair<FString, int32>& E : Save->PracticeBest)
	{
		const FPractice* P = Course.FindPractice(E.Key);
		if (P && P->Kind == TEXT("debug")) ++Debugs;
	}

	auto Add = [&](const TCHAR* Id, const TCHAR* Name, const TCHAR* Desc, bool bCond)
	{
		FAcademiaBadge B;
		B.Id = Id; B.Name = Name; B.Desc = Desc;
		B.bEarned = Save->Badges.Contains(B.Id) || bCond;
		Out.Add(B);
	};
	Add(TEXT("first-lesson"), TEXT("Primer arranque"), TEXT("Completa tu primera lección"), Save->Lessons.Num() >= 1);
	Add(TEXT("ten-lessons"), TEXT("Lector de manuales"), TEXT("Completa 10 lecciones"), Save->Lessons.Num() >= 10);
	Add(TEXT("all-lessons"), TEXT("Enciclopedia SMT"), TEXT("Completa todas las lecciones"), TotalLessons > 0 && Save->Lessons.Num() >= TotalLessons);
	Add(TEXT("first-exam"), TEXT("Primera aprobación"), TEXT("Aprueba un examen de módulo"), bAnyPass);
	Add(TEXT("perfect"), TEXT("Cero escapes"), TEXT("Saca 100% en un examen"), bPerfect);
	Add(TEXT("final"), TEXT("Certificado"), TEXT("Aprueba el examen final"), IsPassed(TEXT("final")));
	Add(TEXT("streak5"), TEXT("En la zona"), TEXT("5 respuestas correctas seguidas"), Save->BestStreak >= 5);
	Add(TEXT("streak15"), TEXT("Imparable"), TEXT("15 respuestas correctas seguidas"), Save->BestStreak >= 15);
	Add(TEXT("maint1"), TEXT("Llave inglesa"), TEXT("Termina un mantenimiento"), Save->MaintBest.Num() >= 1);
	Add(TEXT("maintpro"), TEXT("Mantenimiento perfecto"), TEXT("Un mantenimiento sin errores"), bMaintPerfect);
	Add(TEXT("safety"), TEXT("Seguridad primero"), TEXT("3 mantenimientos sin faltas de seguridad"), Save->MaintSafe.Num() >= 3);
	Add(TEXT("prac1"), TEXT("Hola, programa"), TEXT("Termina una práctica"), Save->PracticeBest.Num() >= 1);
	Add(TEXT("hunter"), TEXT("Cazador de falsos llamados"), TEXT("Termina 3 prácticas de debug"), Debugs >= 3);
	Add(TEXT("creator"), TEXT("Creador de programas"), TEXT("Libera un programa sin escapes"), Save->ProgramsReleased.Num() >= 1);
	Add(TEXT("all-programs"), TEXT("Programador multiplataforma"), TEXT("Libera programas de AOI, SPI, AXI e ICT"), Save->ProgramsReleased.Num() >= 4);
	Add(TEXT("mission1"), TEXT("Primer turno"), TEXT("Termina tu primera misión de carrera"), Save->MissionsDone.Num() >= 1);
	Add(TEXT("mission-all"), TEXT("Técnico de planta"), TEXT("Termina todas las misiones de la historia"), Course.Missions.Num() > 0 && Save->MissionsDone.Num() >= Course.Missions.Num());
	Add(TEXT("days3"), TEXT("Constancia"), TEXT("Estudia 3 días seguidos"), DayStreak() >= 3);
	Add(TEXT("lv5"), TEXT("Nivel 5"), TEXT("Llega a Técnico de debug"), GetLevel().N >= 5);
	for (const FCourseMachine& M : Course.Machines)
	{
		if (Course.ModulesFor(M.Id).Num() == 0) continue;
		FAcademiaBadge B;
		B.Id = TEXT("mach-") + M.Id;
		B.Name = TEXT("Dominio: ") + M.Name;
		B.Desc = TEXT("Completa todos los módulos de ") + M.Name;
		B.Color = M.Color;
		B.bEarned = Save->Badges.Contains(B.Id) || MachineProgress(M.Id) >= 0.999f;
		Out.Add(B);
	}
	return Out;
}

void UAcademiaGameInstance::CheckBadges()
{
	if (!Save) return;
	for (const FAcademiaBadge& B : GetBadges())
	{
		if (B.bEarned && !Save->Badges.Contains(B.Id))
		{
			Save->Badges.Add(B.Id, FDateTime::UtcNow().ToUnixTimestamp());
			Sfx(EAcademiaSfx::Badge);
			Toast(TEXT("Insignia nueva: ") + B.Name);
		}
	}
}

// ---------------------------------------------------------------- Carrera / modo historia

const FCareerMission* UAcademiaGameInstance::ActiveMission() const
{
	return (Save && !Save->CurrentMission.IsEmpty()) ? Course.FindMission(Save->CurrentMission) : nullptr;
}

const FMissionTask* UAcademiaGameInstance::ActiveTask() const
{
	const FCareerMission* M = ActiveMission();
	return (M && M->Tasks.IsValidIndex(Save->CurrentTask)) ? &M->Tasks[Save->CurrentTask] : nullptr;
}

bool UAcademiaGameInstance::IsMissionAvailable(const FCareerMission& M) const
{
	if (!Save) return false;
	if (Save->bFreeMode) return true;
	for (const FString& R : M.Requires) if (!Save->MissionsDone.Contains(R)) return false;
	return true;
}

void UAcademiaGameInstance::StartMission(const FString& MissionId)
{
	const FCareerMission* M = Course.FindMission(MissionId);
	if (!Save || !M) return;
	Save->CurrentMission = MissionId;
	Save->CurrentTask = 0;
	SaveProgress();
	Sfx(EAcademiaSfx::MissionStart);
	OnMissionChanged.Broadcast(M, false);
}

void UAcademiaGameInstance::AbandonMission()
{
	if (!Save) return;
	Save->CurrentMission.Empty();
	Save->CurrentTask = 0;
	SaveProgress();
	OnMissionChanged.Broadcast(nullptr, false);
}

bool UAcademiaGameInstance::NotifyEvent(EAcademiaEvent Event, const FString& Ref)
{
	const FMissionTask* T = ActiveTask();
	if (!T) return false;
	bool bMatch = false;
	switch (T->Kind)
	{
	case EMissionTask::Talk:        bMatch = Event == EAcademiaEvent::TalkDone; break;
	case EMissionTask::Quiz:        bMatch = Event == EAcademiaEvent::QuizDone; break;
	case EMissionTask::GoTo:        bMatch = Event == EAcademiaEvent::ReachedMachine && Ref == T->Machine; break;
	case EMissionTask::Lesson:      bMatch = Event == EAcademiaEvent::LessonDone && Ref == T->Ref; break;
	case EMissionTask::Practice:    bMatch = Event == EAcademiaEvent::PracticeDone && Ref == T->Ref; break;
	case EMissionTask::Maintenance: bMatch = Event == EAcademiaEvent::MaintenanceDone && Ref == T->Ref; break;
	case EMissionTask::Exam:        bMatch = Event == EAcademiaEvent::ExamPassed && Ref == T->Ref; break;
	case EMissionTask::Program:     bMatch = Event == EAcademiaEvent::ProgramReleased && (T->Mode.IsEmpty() || Ref == T->Mode); break;
	}
	if (!bMatch) return false;

	const FCareerMission* M = ActiveMission();
	Save->CurrentTask++;
	if (Save->CurrentTask >= M->Tasks.Num())
	{
		CompleteActiveMission();
	}
	else
	{
		Sfx(EAcademiaSfx::Ok);
		SaveProgress();
		OnMissionChanged.Broadcast(M, false);
	}
	return true;
}

void UAcademiaGameInstance::CompleteActiveMission()
{
	const FCareerMission* M = ActiveMission();
	if (!M) return;
	const bool bFirst = !Save->MissionsDone.Contains(M->Id);
	Save->MissionsDone.Add(M->Id);
	Save->CurrentMission.Empty();
	Save->CurrentTask = 0;
	Sfx(EAcademiaSfx::MissionDone);
	if (bFirst) AddXP(M->RewardXP, TEXT("por la misión ") + M->Title);
	OnCelebrate.Broadcast();
	CheckBadges();
	SaveProgress();
	OnMissionChanged.Broadcast(M, true);
}

// ---------------------------------------------------------------- UI / audio

void UAcademiaGameInstance::Toast(const FString& Msg)
{
	OnToast.Broadcast(Msg);
}

void UAcademiaGameInstance::Sfx(EAcademiaSfx S)
{
	if (Audio && Save && Save->bSound) Audio->Play(S);
}

void UAcademiaGameInstance::ApplyAudioSettings()
{
	if (!Audio || !Save) return;
	Audio->SetSoundEnabled(Save->bSound);
	Audio->SetMusic(Save->bMusic, Save->MusicVolume);
}
