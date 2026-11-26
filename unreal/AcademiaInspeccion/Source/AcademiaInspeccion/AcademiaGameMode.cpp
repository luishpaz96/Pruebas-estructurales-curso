#include "AcademiaGameMode.h"

#include "AcademiaGameInstance.h"
#include "AcademiaPlayerController.h"
#include "InspectionMachine.h"
#include "MentorActor.h"
#include "Engine/World.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/PointLight.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/ExponentialHeightFogComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Components/SphereComponent.h"
#include "GameFramework/FloatingPawnMovement.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/StaticMesh.h"
#include "EngineUtils.h"

// ------------------------------------------------------------------ Pawn

AAcademiaPawn::AAcademiaPawn()
{
	PrimaryActorTick.bCanEverTick = true;
	BaseEyeHeight = 0.f;
	if (GetCollisionComponent()) GetCollisionComponent()->SetSphereRadius(30.f);
	if (UFloatingPawnMovement* M = Cast<UFloatingPawnMovement>(GetMovementComponent()))
	{
		M->MaxSpeed = 260.f;
		M->Acceleration = 1400.f;
		M->Deceleration = 2400.f;
	}
}

void AAcademiaPawn::SetRunning(bool bRun)
{
	if (UFloatingPawnMovement* M = Cast<UFloatingPawnMovement>(GetMovementComponent())) M->MaxSpeed = bRun ? 520.f : 260.f;
}

void AAcademiaPawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (bLockHeight)
	{
		FVector L = GetActorLocation();
		if (!FMath::IsNearlyEqual(L.Z, EyeHeight, 0.5f))
		{
			L.Z = EyeHeight;
			SetActorLocation(L, false, nullptr, ETeleportType::TeleportPhysics);
		}
	}
}

// ------------------------------------------------------------------ GameMode

AAcademiaGameMode::AAcademiaGameMode()
{
	DefaultPawnClass = AAcademiaPawn::StaticClass();
	PlayerControllerClass = AAcademiaPlayerController::StaticClass();
}

UStaticMeshComponent* AAcademiaGameMode::Box(AActor* Owner, const FVector& Center, const FVector& Size, const FLinearColor& Color)
{
	static UStaticMesh* Cube = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Cube.Cube"));
	static UMaterialInterface* Mat = LoadObject<UMaterialInterface>(nullptr, TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(Owner);
	C->SetStaticMesh(Cube);
	C->SetupAttachment(Owner->GetRootComponent());
	C->SetWorldLocation(Center);
	C->SetWorldScale3D(Size / 100.f);
	if (UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(Mat, Owner))
	{
		M->SetVectorParameterValue(TEXT("Color"), Color);
		C->SetMaterial(0, M);
	}
	C->RegisterComponent();
	return C;
}

void AAcademiaGameMode::StartPlay()
{
	UWorld* W = GetWorld();
	Holder = W->SpawnActor<AActor>();
	USceneComponent* R = NewObject<USceneComponent>(Holder);
	Holder->SetRootComponent(R);
	R->RegisterComponent();

	const float LineLen = BuildLine();
	BuildEnvironment(LineLen);

	UAcademiaGameInstance* GI = Cast<UAcademiaGameInstance>(GetGameInstance());
	// Mentora junto a la sala de capacitación
	FActorSpawnParameters P;
	if (AMentorActor* Mentor = W->SpawnActor<AMentorActor>(FVector(-450, -260, 0), FRotator::ZeroRotator, P))
	{
		Mentor->Setup(GI ? GI->Content().MentorName : TEXT("Ing. Andrea Ramírez"), GI ? GI->Content().MentorRole : TEXT("Ingeniera de pruebas"));
	}

	Super::StartPlay();

	// Coloca al jugador en la sala de capacitación mirando a la línea
	for (FConstPlayerControllerIterator It = W->GetPlayerControllerIterator(); It; ++It)
	{
		if (APlayerController* PC = It->Get())
		{
			if (APawn* Pawn = PC->GetPawn())
			{
				Pawn->SetActorLocation(FVector(-600, -380, AAcademiaPawn::EyeHeight), false, nullptr, ETeleportType::TeleportPhysics);
				PC->SetControlRotation(FRotator(-5, 20, 0));
			}
		}
	}
}

float AAcademiaGameMode::BuildLine()
{
	UAcademiaGameInstance* GI = Cast<UAcademiaGameInstance>(GetGameInstance());
	if (!GI) return 2000.f;
	const FCourseContent& C = GI->Content();
	float Cursor = 0.f;   // cm a lo largo de X
	for (const FLineStation& S : C.Line)
	{
		FVector Loc;
		FRotator Rot = FRotator::ZeroRotator;
		if (S.bInline)
		{
			Loc = FVector(Cursor + S.SizeMM.X / 20.f, 0, 0);
			Cursor += S.SizeMM.X / 10.f + S.GapAfterMM / 10.f;
		}
		else
		{
			// Estación fuera de línea: frente hacia el pasillo (+Y mira a la línea)
			Loc = FVector(S.OffsetMM.X / 10.f, S.OffsetMM.Y / 10.f, 0);
			Rot = FRotator(0, 180, 0);
		}
		if (AInspectionMachine* M = GetWorld()->SpawnActor<AInspectionMachine>(Loc, Rot))
		{
			M->Build(S, C.FindMachine(S.MachineId));
		}
	}
	return FMath::Max(Cursor, 1000.f);
}

void AAcademiaGameMode::BuildEnvironment(float LineLen)
{
	UWorld* W = GetWorld();
	const float X0 = -1100.f, X1 = LineLen + 600.f, Y0 = -900.f, Y1 = 600.f;
	// Piso epóxico gris con pasillo peatonal marcado en amarillo
	Box(Holder, FVector((X0 + X1) / 2, (Y0 + Y1) / 2, -5), FVector(X1 - X0, Y1 - Y0, 10), FLinearColor(0.32f, 0.36f, 0.38f));
	Box(Holder, FVector((X0 + X1) / 2, -190, 0.3f), FVector(X1 - X0, 8, 0.6f), FLinearColor(1.f, 0.78f, 0.1f));
	Box(Holder, FVector((X0 + X1) / 2, -560, 0.3f), FVector(X1 - X0, 8, 0.6f), FLinearColor(1.f, 0.78f, 0.1f));
	// Zona ESD: tapete azul frente a la línea
	Box(Holder, FVector(LineLen / 2, -150, 0.2f), FVector(LineLen, 60, 0.4f), FLinearColor(0.1f, 0.2f, 0.4f));
	// Muros bajos de referencia y letreros
	Box(Holder, FVector((X0 + X1) / 2, Y1, 150), FVector(X1 - X0, 20, 300), FLinearColor(0.85f, 0.86f, 0.88f));
	Box(Holder, FVector(X0, (Y0 + Y1) / 2, 150), FVector(20, Y1 - Y0, 300), FLinearColor(0.85f, 0.86f, 0.88f));

	UTextRenderComponent* Sign = NewObject<UTextRenderComponent>(Holder);
	Sign->SetupAttachment(Holder->GetRootComponent());
	Sign->SetWorldLocation(FVector(LineLen / 2, Y1 - 12, 250));
	Sign->SetWorldRotation(FRotator(0, -90, 0));
	Sign->SetText(FText::FromString(TEXT("LÍNEA SMT 1  ·  ÁREA DE PRUEBAS  ·  ZONA ESD")));
	Sign->SetWorldSize(30.f);
	Sign->SetHorizontalAlignment(EHTA_Center);
	Sign->SetTextRenderColor(FColor(30, 40, 60));
	Sign->RegisterComponent();

	BuildTrainingRoom(FVector(-750, -300, 0));

	// Luz: sol + cielo + atmósfera + niebla suave, más lámparas de nave industrial
	if (ADirectionalLight* Sun = W->SpawnActor<ADirectionalLight>(FVector::ZeroVector, FRotator(-50, 35, 0)))
	{
		if (UDirectionalLightComponent* DL = Cast<UDirectionalLightComponent>(Sun->GetLightComponent()))
		{
			DL->SetMobility(EComponentMobility::Movable);
			DL->SetIntensity(6.f);
			DL->SetAtmosphereSunLight(true);
		}
	}
	AActor* Sky = W->SpawnActor<AActor>();
	USkyAtmosphereComponent* Atm = NewObject<USkyAtmosphereComponent>(Sky);
	Sky->SetRootComponent(Atm);
	Atm->RegisterComponent();
	UExponentialHeightFogComponent* Fog = NewObject<UExponentialHeightFogComponent>(Sky);
	Fog->SetupAttachment(Atm);
	Fog->SetFogDensity(0.004f);
	Fog->RegisterComponent();
	if (ASkyLight* SL = W->SpawnActor<ASkyLight>())
	{
		if (USkyLightComponent* SC = SL->GetLightComponent())
		{
			SC->SetMobility(EComponentMobility::Movable);
			SC->bRealTimeCapture = true;
			SC->SetIntensity(1.2f);
			SC->RecaptureSky();
		}
	}
	for (float X = X0 + 300; X < X1; X += 600)
	{
		for (float Y = -500; Y <= 300; Y += 400)
		{
			APointLight* L = W->SpawnActor<APointLight>(FVector(X, Y, 420), FRotator::ZeroRotator);
			if (UPointLightComponent* PL = L ? Cast<UPointLightComponent>(L->GetLightComponent()) : nullptr)
			{
				PL->SetMobility(EComponentMobility::Movable);
				PL->SetIntensity(9000.f);
				PL->SetAttenuationRadius(1100.f);
				PL->SetCastShadows(false);
				PL->SetLightColor(FLinearColor(1.f, 0.97f, 0.92f));
			}
		}
	}
}

void AAcademiaGameMode::BuildTrainingRoom(const FVector& O)
{
	// Sala de capacitación: mesa, sillas, pizarrón y una tarjeta de práctica sobre la mesa
	Box(Holder, O + FVector(0, 0, 74), FVector(180, 80, 4), FLinearColor(0.55f, 0.42f, 0.3f));
	for (int32 i = 0; i < 4; ++i) Box(Holder, O + FVector((i % 2 ? 80 : -80), (i / 2 ? 34 : -34), 36), FVector(5, 5, 72), FLinearColor(0.2f, 0.2f, 0.22f));
	for (int32 i = 0; i < 3; ++i) Box(Holder, O + FVector(-60 + i * 60, -70, 45), FVector(45, 45, 6), FLinearColor(0.15f, 0.25f, 0.45f));
	Box(Holder, O + FVector(0, 0, 77), FVector(18, 12, 0.4f), FLinearColor(0.08f, 0.33f, 0.18f));
	Box(Holder, O + FVector(-180, 120, 150), FVector(10, 220, 120), FLinearColor(0.95f, 0.96f, 0.97f));
	UTextRenderComponent* T = NewObject<UTextRenderComponent>(Holder);
	T->SetupAttachment(Holder->GetRootComponent());
	T->SetWorldLocation(O + FVector(-174, 120, 175));
	T->SetWorldRotation(FRotator(0, 0, 0));
	T->SetText(FText::FromString(TEXT("SALA DE CAPACITACIÓN\nAOI · SPI · AXI · ICT")));
	T->SetWorldSize(16.f);
	T->SetHorizontalAlignment(EHTA_Center);
	T->SetTextRenderColor(FColor(20, 60, 140));
	T->RegisterComponent();
}
