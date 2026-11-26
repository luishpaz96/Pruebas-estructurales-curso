#include "MentorActor.h"

#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/PlayerController.h"
#include "Camera/PlayerCameraManager.h"

AMentorActor::AMentorActor()
{
	PrimaryActorTick.bCanEverTick = true;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;
	BodyRoot = CreateDefaultSubobject<USceneComponent>(TEXT("Body"));
	BodyRoot->SetupAttachment(Root);
	NameTag = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Name"));
	NameTag->SetupAttachment(Root);
	NameTag->SetRelativeLocation(FVector(0, 0, 200));
	NameTag->SetHorizontalAlignment(EHTA_Center);
	NameTag->SetWorldSize(10.f);
	NameTag->SetTextRenderColor(FColor(255, 176, 32));

	static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeF(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> CylF(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> SphF(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> MatF(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	Cube = CubeF.Object; Cyl = CylF.Object; Sphere = SphF.Object; Mat = MatF.Object;
}

UStaticMeshComponent* AMentorActor::Part(UStaticMesh* Mesh, FVector Loc, FVector Scale, FLinearColor Color)
{
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(this);
	C->SetStaticMesh(Mesh);
	C->SetupAttachment(BodyRoot);
	C->SetRelativeLocation(Loc);
	C->SetRelativeScale3D(Scale);
	C->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	if (UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(Mat, this))
	{
		M->SetVectorParameterValue(TEXT("Color"), Color);
		C->SetMaterial(0, M);
	}
	C->RegisterComponent();
	return C;
}

void AMentorActor::Setup(const FString& Name, const FString& Role)
{
	NameTag->SetText(FText::FromString(Name + TEXT("\n") + Role));
	const FLinearColor Coat(0.92f, 0.93f, 0.95f), Pants(0.12f, 0.15f, 0.22f), Skin(0.72f, 0.52f, 0.4f), Helmet(0.1f, 0.4f, 0.9f), Esd(0.1f, 0.35f, 0.75f);
	Part(Cyl, FVector(0, -8, 45), FVector(0.14f, 0.14f, 0.9f), Pants);   // piernas
	Part(Cyl, FVector(0, 8, 45), FVector(0.14f, 0.14f, 0.9f), Pants);
	Part(Cyl, FVector(0, 0, 118), FVector(0.4f, 0.4f, 0.62f), Coat);     // torso con bata
	Part(Cube, FVector(-20.5f, 0, 120), FVector(0.01f, 0.2f, 0.3f), Esd); // bata ESD azul al frente
	Part(Cyl, FVector(0, -24, 115), FVector(0.1f, 0.1f, 0.6f), Coat);    // brazos
	Part(Cyl, FVector(0, 24, 115), FVector(0.1f, 0.1f, 0.6f), Coat);
	Part(Cyl, FVector(0, 0, 152), FVector(0.1f, 0.1f, 0.1f), Skin);      // cuello
	Head = Part(Sphere, FVector(0, 0, 167), FVector(0.24f, 0.22f, 0.27f), Skin);
	Part(Sphere, FVector(0, 0, 175), FVector(0.27f, 0.27f, 0.17f), Helmet); // casco
	Part(Cube, FVector(-11, 0, 169), FVector(0.02f, 0.18f, 0.04f), FLinearColor(0.05f, 0.05f, 0.05f)); // lentes
	Part(Cube, FVector(-20.6f, 8, 132), FVector(0.01f, 0.07f, 0.09f), FLinearColor(1.f, 0.69f, 0.13f)); // gafete
}

void AMentorActor::WalkTo(const FVector& InTarget, const FVector& LookAt)
{
	Target = FVector(InTarget.X, InTarget.Y, 0.f);
	LookAtPoint = LookAt;
	bWalking = true;
}

void AMentorActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Time += DeltaSeconds;
	FVector Loc = GetActorLocation();
	FVector Face = LookAtPoint;
	if (bWalking)
	{
		const FVector D = Target - FVector(Loc.X, Loc.Y, 0);
		const float Dist = D.Size2D();
		if (Dist < 5.f) bWalking = false;
		else
		{
			const float Speed = FMath::Min(160.f * DeltaSeconds, Dist);
			Loc += D.GetSafeNormal2D() * Speed;
			SetActorLocation(FVector(Loc.X, Loc.Y, 0));
			Face = Target;
		}
	}
	else if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
	{
		if (PC->PlayerCameraManager) Face = PC->PlayerCameraManager->GetCameraLocation();
	}
	// El modelo mira hacia -X; giramos para que el frente vea al objetivo
	const FVector Dir = (Face - Loc).GetSafeNormal2D();
	if (!Dir.IsNearlyZero())
	{
		const FRotator Want(0, Dir.Rotation().Yaw + 180.f, 0);
		SetActorRotation(FMath::RInterpTo(GetActorRotation(), Want, DeltaSeconds, 5.f));
	}
	// Caminar: rebote; hablar: cabeceo
	BodyRoot->SetRelativeLocation(FVector(0, 0, bWalking ? FMath::Abs(FMath::Sin(Time * 9.f)) * 3.f : FMath::Sin(Time * 1.5f) * 0.6f));
	if (Head) Head->SetRelativeRotation(FRotator(bTalking ? FMath::Sin(Time * 8.f) * 6.f : 0.f, 0, 0));
	// La etiqueta siempre de frente a la cámara
	if (APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
	{
		if (PC->PlayerCameraManager)
		{
			const FVector C = PC->PlayerCameraManager->GetCameraLocation();
			NameTag->SetWorldRotation(FRotator(0, (C - NameTag->GetComponentLocation()).Rotation().Yaw, 0));
		}
	}
}
