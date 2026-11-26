#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "AcademiaPlayerController.generated.h"

class SAcademiaShell;
class AInspectionMachine;
class AMentorActor;

UCLASS()
class ACADEMIAINSPECCION_API AAcademiaPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AAcademiaPlayerController();

	TSharedPtr<SAcademiaShell> GetShell() const { return Shell; }
	AInspectionMachine* FindMachine(const FString& MachineId) const;
	TArray<AInspectionMachine*> GetMachines() const;
	AInspectionMachine* GetNearestMachine(float MaxDistCm = 260.f) const;
	AMentorActor* GetMentor() const;

	// Lleva la cámara frente a la máquina (para mantenimiento o al abrir su software). nullptr = regresa a caminar.
	void FocusMachine(AInspectionMachine* Machine);
	AInspectionMachine* GetFocusedMachine() const { return Focused.Get(); }
	// Teletransporta al jugador frente a la máquina (menú "Ir a...")
	void TeleportTo(AInspectionMachine* Machine);

	// La UI llama esto cuando abre/cierra vistas: cambia entre caminar (mouse capturado) y usar la interfaz.
	void SetUIMode(bool bUI);
	bool IsUIMode() const { return bUIMode; }

	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;
	virtual void SetupInputComponent() override;

private:
	void OnInteract();
	void OnMenu();
	void OnClick();
	void OnRunPressed();
	void OnRunReleased();
	void UpdateHover();

	TSharedPtr<SAcademiaShell> Shell;
	TWeakObjectPtr<AInspectionMachine> Focused;
	TWeakObjectPtr<AInspectionMachine> LastNear;
	FTransform WalkTransform;     // posición al entrar al modo enfoque
	FVector CamTargetLoc;
	FRotator CamTargetRot;
	float CamBlend = 1.f;
	bool bUIMode = false;
};
