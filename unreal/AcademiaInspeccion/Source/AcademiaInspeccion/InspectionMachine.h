#pragma once

// Máquina de la línea SMT construida por código a escala real (1 uu = 1 cm) con piezas seleccionables.

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "CourseContent.h"
#include "InspectionMachine.generated.h"

class UStaticMeshComponent;
class UMaterialInstanceDynamic;
class UTextRenderComponent;
class USceneComponent;

UCLASS()
class ACADEMIAINSPECCION_API AInspectionMachine : public AActor
{
	GENERATED_BODY()

public:
	AInspectionMachine();

	// Construye la geometría según Station.Template: aoi | spi | axi | ict | printer | pnp | reflow | loader | unloader | generic
	void Build(const FLineStation& InStation, const FCourseMachine* Machine);

	const FLineStation& GetStation() const { return Station; }
	const FString& GetMachineId() const { return Station.MachineId; }
	bool IsInteractive() const { return !Station.MachineId.IsEmpty(); }

	// Piezas para el taller de mantenimiento (ids de content/maintenance)
	TArray<FString> GetPartIds() const;
	bool HasPart(const FString& Part) const;
	FString PartFromComponent(const UPrimitiveComponent* Comp) const;
	void HighlightPart(const FString& Part, FLinearColor Color, float Seconds = 1.2f);
	void SetHover(const FString& Part);
	void ClearHighlights();
	void SetEmergency(bool bOn);
	void SetDoorOpen(bool bOpen);
	void SetRunning(bool bOn) { bRunning = bOn; }
	bool IsDoorOpen() const { return bDoorOpen; }

	// Punto desde donde mirar la máquina (frente, a la altura de los ojos) y a dónde mirar
	FVector GetViewLocation() const;
	FVector GetFocusLocation() const;
	FVector GetFrontLocation(float DistanceCm = 140.f) const;
	FVector GetSizeCm() const { return Station.SizeMM / 10.f; }

	virtual void Tick(float DeltaSeconds) override;

private:
	UStaticMeshComponent* AddBox(const FString& Part, USceneComponent* Parent, FVector CenterCm, FVector SizeCm, FLinearColor Color, FRotator Rot = FRotator::ZeroRotator);
	UStaticMeshComponent* AddCyl(const FString& Part, USceneComponent* Parent, FVector CenterCm, float DiameterCm, float HeightCm, FLinearColor Color, FRotator Rot = FRotator::ZeroRotator);
	UStaticMeshComponent* AddSphere(const FString& Part, USceneComponent* Parent, FVector CenterCm, float DiameterCm, FLinearColor Color);
	USceneComponent* AddGroup(const FString& Part, USceneComponent* Parent, FVector LocCm);
	UTextRenderComponent* AddLabel(const FString& Text, FVector LocCm, float SizeCm, FLinearColor Color, FRotator Rot = FRotator(0, 180, 0));
	void BuildCabinet(const FVector& S, float Conv);
	void BuildConveyor(const FVector& S, float Conv, float ExtraCm);
	void BuildCommon(const FVector& S, float Conv);
	void BuildAOI(const FVector& S, float Conv, bool bSPI);
	void BuildAXI(const FVector& S, float Conv);
	void BuildICT(const FVector& S, float Conv);
	void BuildPrinter(const FVector& S, float Conv);
	void BuildPnP(const FVector& S, float Conv);
	void BuildReflow(const FVector& S, float Conv);
	void SetPartColor(const FString& Part, FLinearColor Color);

	UPROPERTY() TObjectPtr<USceneComponent> Root;
	FLineStation Station;

	struct FMeshInfo { TWeakObjectPtr<UStaticMeshComponent> Mesh; TWeakObjectPtr<UMaterialInstanceDynamic> Mat; FLinearColor Base; FString Part; };
	TArray<FMeshInfo> Meshes;
	TMap<FString, TWeakObjectPtr<USceneComponent>> PartRoots;
	TMap<FString, float> HighlightUntil;
	TMap<FString, FLinearColor> HighlightColor;
	FString HoverPart;

	TWeakObjectPtr<USceneComponent> Head;     // cabezal móvil (AOI/SPI/PnP)
	TWeakObjectPtr<USceneComponent> Door;
	TWeakObjectPtr<USceneComponent> Blades;
	TWeakObjectPtr<USceneComponent> Board;    // tarjeta que viaja por el transportador
	TArray<TWeakObjectPtr<UMaterialInstanceDynamic>> Lamps; // rojo, ámbar, verde
	float HeadTravel = 30.f;
	float Time = 0.f;
	bool bRunning = true;
	bool bEmergency = false;
	bool bDoorOpen = false;
	float DoorAngle = 0.f;
	bool bHadEffects = false;
};
