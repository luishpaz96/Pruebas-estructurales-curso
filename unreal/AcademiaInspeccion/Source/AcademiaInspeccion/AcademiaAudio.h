#pragma once

// Música y efectos generados por código (síntesis simple), así el juego no depende de archivos de audio.

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "AcademiaAudio.generated.h"

class USoundWaveProcedural;
class UAudioComponent;

UENUM()
enum class EAcademiaSfx : uint8
{
	Click, Ok, Bad, Level, Badge, Toast, Beep, Alarm, Conveyor, Xray, MissionStart, MissionDone
};

UCLASS()
class ACADEMIAINSPECCION_API UAcademiaAudio : public UObject
{
	GENERATED_BODY()

public:
	void Init(UWorld* InWorld);
	void Play(EAcademiaSfx Sfx);
	void SetMusic(bool bOn, float Volume);
	void SetSoundEnabled(bool bOn) { bSound = bOn; }
	void Shutdown();

private:
	TArray<uint8> Render(EAcademiaSfx Sfx) const;
	void BuildMusicLoop();
	void OnMusicUnderflow(USoundWaveProcedural* Wave, int32 SamplesRequired);

	UPROPERTY() TObjectPtr<UAudioComponent> MusicComp;
	UPROPERTY() TObjectPtr<USoundWaveProcedural> MusicWave;
	TWeakObjectPtr<UWorld> World;
	TArray<uint8> MusicLoop;   // PCM 16 bits mono 22050 Hz
	bool bSound = true;
	static constexpr int32 SampleRate = 22050;
};
