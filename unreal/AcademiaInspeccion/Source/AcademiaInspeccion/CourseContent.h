#pragma once

// Contenido del curso leído en tiempo de ejecución desde la carpeta content/ del repo
// (copiada a Content/CursoData). Nada de esto está "horneado" en el código: para agregar
// módulos, exámenes, misiones o máquinas se agregan JSON y se reinicia el juego.

#include "CoreMinimal.h"
#include "AcademiaGerber.h"

struct FCourseMachine
{
	FString Id, Name, Brand, Model, Description;
	FLinearColor Color = FLinearColor(0.24f, 0.55f, 1.f);
};

struct FLessonBlock
{
	FString Kind;              // text | bullets | tip | warning
	FString Text;
	TArray<FString> Items;
};

struct FCourseLesson
{
	FString Id, Title, Animation;
	TArray<FLessonBlock> Blocks;
	TArray<FString> KeyPoints;
};

struct FExamQuestion
{
	FString Id;                // generado: <examen>-q<n>
	FString Type;              // mc | tf | case
	FString Q;
	TArray<FString> Options;   // en tf: {"Verdadero","Falso"}
	int32 Correct = 0;         // índice de la opción correcta
	FString Explain, Section;
};

struct FCourseExam
{
	FString Id, Title;
	int32 PassScore = 70;
	TArray<FExamQuestion> Questions;
};

struct FCourseModule
{
	FString Id, Brand, Machine, Title, Summary;
	int32 Order = 0;
	TArray<FCourseLesson> Lessons;
	FCourseExam Exam;
};

struct FMaintStep { FString Part, Action, Text; };

struct FMaintProc
{
	FString Id, Machine, Title, Frequency;
	TArray<FString> Safety;
	TArray<FMaintStep> Steps;
};

struct FPracticeStep
{
	FString Prompt;
	TArray<FString> Options;
	int32 Correct = 0;
	FString Feedback;
};

struct FPracticeParam
{
	FString Name, Unit, Hint;
	float Min = 0, Max = 100, Start = 0, TargetMin = 0, TargetMax = 100;
	bool bLowIsEscape = false; // lowEffect: "escape" -> por debajo del objetivo hay escapes
};

struct FPractice
{
	FString Id, Machine, Kind, Title, Scenario; // Kind: create | debug
	TArray<FPracticeStep> Steps;
	TArray<FPracticeParam> Params;
};

enum class EMissionTask : uint8
{
	Talk,        // el mentor explica (Text)
	GoTo,        // caminar a la máquina (Machine)
	Lesson,      // ver una lección (Ref = id de lección)
	Practice,    // práctica de content/practices (Ref)
	Maintenance, // procedimiento de content/maintenance (Ref)
	Exam,        // examen de módulo (Ref = id de módulo) o "final"
	Program,     // crear un programa en el software simulado (Mode = aoi|spi|axi|ict)
	Quiz         // pregunta directa del mentor (Quiz)
};

struct FMissionTask
{
	EMissionTask Kind = EMissionTask::Talk;
	FString Ref, Machine, Mode, Text;
	FExamQuestion Quiz;
};

struct FCareerMission
{
	FString Id, Title, Type, Machine, Brief; // Type: npi | debug | falla | cambio_modelo | fixture_ict | mantenimiento | induccion
	int32 Order = 0;
	TArray<FString> MentorIntro, MentorOutro;
	TArray<FMissionTask> Tasks;
	TArray<FString> Requires;
	int32 RewardXP = 150;
	FString RewardTitle;
};

// Una estación de la línea SMT a escala real (milímetros, como en las hojas de datos).
struct FLineStation
{
	FString Id, Name, Template, MachineId, Source;
	FVector SizeMM = FVector(1000, 1300, 1600);   // Ancho (sentido del transportador) x Fondo x Alto
	float ConveyorHeightMM = 900.f;
	bool bInline = true;          // false: estación fuera de línea (ICT, retrabajo)
	bool bApprox = false;         // medida aproximada (no viene de un manual del proyecto)
	FVector2D OffsetMM = FVector2D::ZeroVector; // posición para estaciones fuera de línea
	float GapAfterMM = 400.f;
	FLinearColor Color = FLinearColor(0.85f, 0.87f, 0.9f);
	FLinearColor Accent = FLinearColor(0.24f, 0.55f, 1.f);
};

struct ACADEMIAINSPECCION_API FCourseContent
{
	FString RootDir;
	TArray<FCourseMachine> Machines;
	TArray<FCourseModule> Modules;
	FCourseExam FinalExam;
	TArray<FMaintProc> Maintenance;
	TArray<FPractice> Practices;
	TArray<FCareerMission> Missions;
	TArray<FLineStation> Line;
	FString MentorName = TEXT("Ing. Andrea Ramírez");
	FString MentorRole = TEXT("Ingeniera de pruebas");
	TSharedPtr<FLoadedBoard> Board;
	TArray<FString> Errors;   // problemas al leer; se muestran en Ajustes > Contenido

	// Busca content/: primero Content/CursoData (juego empaquetado), luego ../../content (repo).
	static FString ResolveContentDir();
	bool Load(const FString& Dir);

	const FCourseMachine* FindMachine(const FString& Id) const;
	const FCourseModule* FindModule(const FString& Id) const;
	const FCourseLesson* FindLesson(const FString& LessonId, const FCourseModule** OutModule = nullptr) const;
	const FMaintProc* FindMaintenance(const FString& Id) const;
	const FPractice* FindPractice(const FString& Id) const;
	const FCareerMission* FindMission(const FString& Id) const;
	const FLineStation* FindStationForMachine(const FString& MachineId) const;
	TArray<const FCourseModule*> ModulesFor(const FString& MachineId) const;

	// Nombres en español de piezas y acciones del taller (mismos ids que content/maintenance)
	static FString PartName(const FString& Part);
	static FString ActionName(const FString& Action);
	static const TArray<FString>& AllActions();
	// Modo del simulador de software para una máquina (aoi | spi | axi | ict)
	static FString SoftwareModeFor(const FString& MachineId);
};

namespace AcademiaColor
{
	ACADEMIAINSPECCION_API FLinearColor FromHex(const FString& Hex, const FLinearColor& Fallback = FLinearColor::White);
}
