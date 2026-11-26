#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "AcademiaSaveGame.generated.h"

// Progreso del alumno. Se guarda en Saved/SaveGames/Academia.sav
UCLASS()
class ACADEMIAINSPECCION_API UAcademiaSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY() int32 XP = 0;
	UPROPERTY() TSet<FString> Lessons;
	UPROPERTY() TMap<FString, int32> ExamBest;       // id de módulo o "final" -> mejor %
	UPROPERTY() TMap<FString, int32> MaintBest;      // id de procedimiento -> mejor %
	UPROPERTY() TSet<FString> MaintSafe;             // procedimientos hechos sin faltas de seguridad
	UPROPERTY() TMap<FString, int32> PracticeBest;   // id de práctica -> mejor %
	UPROPERTY() TSet<FString> ProgramsReleased;      // modos (aoi/spi/axi/ict) con programa liberado sin escapes
	UPROPERTY() TMap<FString, int64> Badges;         // id -> fecha (Unix)
	UPROPERTY() TMap<FString, int32> Wrong;          // id de pregunta -> veces fallada (banco de repaso)
	UPROPERTY() int32 Streak = 0;
	UPROPERTY() int32 BestStreak = 0;
	UPROPERTY() TArray<FString> Days;                // AAAA-MM-DD con actividad

	// Carrera
	UPROPERTY() TSet<FString> MissionsDone;
	UPROPERTY() FString CurrentMission;
	UPROPERTY() int32 CurrentTask = 0;

	// Ajustes
	UPROPERTY() bool bSound = true;
	UPROPERTY() bool bMusic = true;
	UPROPERTY() float MusicVolume = 0.35f;
	UPROPERTY() bool bFreeMode = false;   // modo instructor: todo desbloqueado
	UPROPERTY() bool bTimer = false;      // exámenes con tiempo
};
