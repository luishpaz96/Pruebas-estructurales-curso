#pragma once

#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "CourseContent.h"
#include "AcademiaAudio.h"
#include "AcademiaGameInstance.generated.h"

class UAcademiaSaveGame;

DECLARE_MULTICAST_DELEGATE_OneParam(FOnAcademiaToast, const FString& /*Mensaje*/);
DECLARE_MULTICAST_DELEGATE(FOnAcademiaProgress);
DECLARE_MULTICAST_DELEGATE_TwoParams(FOnMissionChanged, const FCareerMission* /*Mission*/, bool /*bCompleted*/);

struct FAcademiaLevel
{
	int32 N = 1;
	FString Name;
	int32 From = 0, To = 0;
	float Pct = 0.f;
};

struct FAcademiaBadge
{
	FString Id, Name, Desc;
	FLinearColor Color = FLinearColor(1.f, 0.69f, 0.13f);
	bool bEarned = false;
};

// Eventos que pueden avanzar la misión de carrera activa
enum class EAcademiaEvent : uint8 { ReachedMachine, LessonDone, PracticeDone, MaintenanceDone, ExamPassed, ProgramReleased, TalkDone, QuizDone };

UCLASS()
class ACADEMIAINSPECCION_API UAcademiaGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	virtual void Init() override;
	virtual void Shutdown() override;
	virtual void OnStart() override;

	static UAcademiaGameInstance* Get(const UObject* WorldContext);

	const FCourseContent& Content() const { return Course; }
	void ReloadContent();
	UAcademiaSaveGame* Progress() const { return Save; }
	void SaveProgress();
	void ResetProgress();
	FString ExportProgress() const;          // JSON para pasarlo a otra PC
	bool ImportProgress(const FString& Json);

	// Gamificación
	void AddXP(int32 N, const FString& Why);
	void RegisterAnswer(bool bOk, const FString& QuestionId);
	void CompleteLesson(const FString& LessonId);
	void RecordExam(const FString& ExamId, int32 Pct);
	void RecordMaintenance(const FString& ProcId, int32 Pct, bool bSafe);
	void RecordPractice(const FString& PracticeId, int32 Pct);
	void RecordProgramReleased(const FString& Mode);

	FAcademiaLevel GetLevel() const;
	static const TArray<TPair<int32, FString>>& Levels();
	bool IsPassed(const FString& ExamId) const;
	float ModuleProgress(const FCourseModule& M) const;
	float MachineProgress(const FString& MachineId) const;
	bool IsUnlocked(const FCourseModule& M) const;
	TArray<FAcademiaBadge> GetBadges() const;
	int32 DayStreak() const;

	// Carrera
	const FCareerMission* ActiveMission() const;
	const FMissionTask* ActiveTask() const;
	bool IsMissionAvailable(const FCareerMission& M) const;
	void StartMission(const FString& MissionId);
	void AbandonMission();
	// Avanza la tarea actual si coincide. Devuelve true si avanzó.
	bool NotifyEvent(EAcademiaEvent Event, const FString& Ref);
	FOnMissionChanged OnMissionChanged;

	// UI y sonido
	void Toast(const FString& Msg);
	void Sfx(EAcademiaSfx S);
	void ApplyAudioSettings();
	FOnAcademiaToast OnToast;
	FOnAcademiaProgress OnProgress;
	// Pide al shell mostrar confeti / celebración
	FSimpleMulticastDelegate OnCelebrate;

private:
	void CheckBadges();
	void MarkDay();
	void CompleteActiveMission();

	FCourseContent Course;
	UPROPERTY() TObjectPtr<UAcademiaSaveGame> Save;
	UPROPERTY() TObjectPtr<UAcademiaAudio> Audio;
	static const FString SlotName;
};
