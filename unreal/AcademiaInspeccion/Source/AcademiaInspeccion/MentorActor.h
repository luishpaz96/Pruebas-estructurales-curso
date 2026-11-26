#pragma once

// La ingeniera de pruebas que guía al jugador. Figura simple hecha con primitivas: bata, casco y lentes.

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MentorActor.generated.h"

class UStaticMeshComponent;
class UTextRenderComponent;

UCLASS()
class ACADEMIAINSPECCION_API AMentorActor : public AActor
{
	GENERATED_BODY()

public:
	AMentorActor();
	void Setup(const FString& Name, const FString& Role);
	// Camina hasta el punto (en el piso) y voltea hacia LookAt
	void WalkTo(const FVector& Target, const FVector& LookAt);
	void SetTalking(bool bOn) { bTalking = bOn; }
	virtual void Tick(float DeltaSeconds) override;

private:
	UStaticMeshComponent* Part(UStaticMesh* Mesh, FVector Loc, FVector Scale, FLinearColor Color);

	UPROPERTY() TObjectPtr<USceneComponent> Root;
	UPROPERTY() TObjectPtr<USceneComponent> BodyRoot;
	UPROPERTY() TObjectPtr<UTextRenderComponent> NameTag;
	UPROPERTY() TObjectPtr<UStaticMesh> Cube;
	UPROPERTY() TObjectPtr<UStaticMesh> Cyl;
	UPROPERTY() TObjectPtr<UStaticMesh> Sphere;
	UPROPERTY() TObjectPtr<UMaterialInterface> Mat;
	UPROPERTY() TObjectPtr<UStaticMeshComponent> Head;
	FVector Target = FVector::ZeroVector;
	FVector LookAtPoint = FVector::ZeroVector;
	bool bWalking = false;
	bool bTalking = false;
	float Time = 0.f;
};
