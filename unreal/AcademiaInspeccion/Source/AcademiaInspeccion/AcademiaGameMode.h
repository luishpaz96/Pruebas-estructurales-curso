#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "GameFramework/DefaultPawn.h"
#include "AcademiaGameMode.generated.h"

// Jugador: camina por la planta (WASD + mouse, Shift corre). Altura de ojos fija de 1.65 m.
UCLASS()
class ACADEMIAINSPECCION_API AAcademiaPawn : public ADefaultPawn
{
	GENERATED_BODY()
public:
	AAcademiaPawn();
	virtual void Tick(float DeltaSeconds) override;
	void SetRunning(bool bRun);
	bool bLockHeight = true;
	static constexpr float EyeHeight = 165.f;
};

// Arma la planta por código: piso, luces, línea SMT a escala real (content/line.json), sala de capacitación y mentora.
UCLASS()
class ACADEMIAINSPECCION_API AAcademiaGameMode : public AGameModeBase
{
	GENERATED_BODY()
public:
	AAcademiaGameMode();
	virtual void StartPlay() override;

private:
	void BuildEnvironment(float LineLengthCm);
	float BuildLine();
	void BuildTrainingRoom(const FVector& Origin);
	class UStaticMeshComponent* Box(AActor* Owner, const FVector& Center, const FVector& Size, const FLinearColor& Color);
	AActor* Holder = nullptr;
};
