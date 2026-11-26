#include "AcademiaPlayerController.h"

#include "SAcademiaShell.h"
#include "AcademiaGameInstance.h"
#include "AcademiaGameMode.h"
#include "InspectionMachine.h"
#include "MentorActor.h"
#include "Engine/GameViewportClient.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "Framework/Application/SlateApplication.h"
#include "Components/InputComponent.h"

AAcademiaPlayerController::AAcademiaPlayerController()
{
	PrimaryActorTick.bCanEverTick = true;
	bShowMouseCursor = false;
	bEnableClickEvents = true;
	bEnableMouseOverEvents = true;
}

void AAcademiaPlayerController::BeginPlay()
{
	Super::BeginPlay();
	if (!IsLocalController() || !GEngine || !GEngine->GameViewport) return;
	SAssignNew(Shell, SAcademiaShell).Owner(this);
	GEngine->GameViewport->AddViewportWidgetContent(Shell.ToSharedRef(), 10);
	SetUIMode(false);
	Shell->ShowMainMenu();
}

void AAcademiaPlayerController::EndPlay(const EEndPlayReason::Type Reason)
{
	if (Shell.IsValid() && GEngine && GEngine->GameViewport)
		GEngine->GameViewport->RemoveViewportWidgetContent(Shell.ToSharedRef());
	Shell.Reset();
	Super::EndPlay(Reason);
}

void AAcademiaPlayerController::SetupInputComponent()
{
	Super::SetupInputComponent();
	InputComponent->BindAction("Interact", IE_Pressed, this, &AAcademiaPlayerController::OnInteract);
	InputComponent->BindAction("Menu", IE_Pressed, this, &AAcademiaPlayerController::OnMenu);
	InputComponent->BindAction("Click", IE_Pressed, this, &AAcademiaPlayerController::OnClick);
	InputComponent->BindAction("Run", IE_Pressed, this, &AAcademiaPlayerController::OnRunPressed);
	InputComponent->BindAction("Run", IE_Released, this, &AAcademiaPlayerController::OnRunReleased);
}

void AAcademiaPlayerController::OnRunPressed()
{
	if (AAcademiaPawn* P = Cast<AAcademiaPawn>(GetPawn())) P->SetRunning(true);
}

void AAcademiaPlayerController::OnRunReleased()
{
	if (AAcademiaPawn* P = Cast<AAcademiaPawn>(GetPawn())) P->SetRunning(false);
}

void AAcademiaPlayerController::SetUIMode(bool bUI)
{
	bUIMode = bUI;
	// Con el panel de mantenimiento la cámara está enfocada en la máquina y el mouse elige piezas
	const bool bCursor = bUI || Focused.IsValid();
	bShowMouseCursor = bCursor;
	SetIgnoreMoveInput(bCursor);
	SetIgnoreLookInput(bCursor);
	if (bCursor)
	{
		FInputModeGameAndUI Mode;
		Mode.SetLockMouseToViewportBehavior(EMouseLockMode::DoNotLock);
		Mode.SetHideCursorDuringCapture(false);
		if (Shell.IsValid()) Mode.SetWidgetToFocus(Shell);
		SetInputMode(Mode);
	}
	else
	{
		SetInputMode(FInputModeGameOnly());
	}
	// SetIgnore*Input acumula; lo reiniciamos para que no quede bloqueado
	if (!bCursor) { ResetIgnoreMoveInput(); ResetIgnoreLookInput(); }
}

TArray<AInspectionMachine*> AAcademiaPlayerController::GetMachines() const
{
	TArray<AInspectionMachine*> Out;
	for (TActorIterator<AInspectionMachine> It(GetWorld()); It; ++It) Out.Add(*It);
	return Out;
}

AInspectionMachine* AAcademiaPlayerController::FindMachine(const FString& MachineId) const
{
	for (TActorIterator<AInspectionMachine> It(GetWorld()); It; ++It)
		if (It->GetMachineId() == MachineId) return *It;
	return nullptr;
}

AMentorActor* AAcademiaPlayerController::GetMentor() const
{
	for (TActorIterator<AMentorActor> It(GetWorld()); It; ++It) return *It;
	return nullptr;
}

AInspectionMachine* AAcademiaPlayerController::GetNearestMachine(float MaxDistCm) const
{
	const APawn* P = GetPawn();
	if (!P) return nullptr;
	const FVector L = P->GetActorLocation();
	AInspectionMachine* Best = nullptr;
	float BestD = MaxDistCm;
	for (TActorIterator<AInspectionMachine> It(GetWorld()); It; ++It)
	{
		if (!It->IsInteractive()) continue;
		// Distancia al rectángulo de la huella de la máquina
		const FVector Local = It->GetActorTransform().InverseTransformPosition(L);
		const FVector H = It->GetSizeCm() / 2;
		const float DX = FMath::Max(0.f, FMath::Abs(Local.X) - H.X), DY = FMath::Max(0.f, FMath::Abs(Local.Y) - H.Y);
		const float D = FMath::Sqrt(DX * DX + DY * DY);
		if (D < BestD) { BestD = D; Best = *It; }
	}
	return Best;
}

void AAcademiaPlayerController::FocusMachine(AInspectionMachine* Machine)
{
	APawn* P = GetPawn();
	AAcademiaPawn* AP = Cast<AAcademiaPawn>(P);
	if (Machine)
	{
		if (!Focused.IsValid() && P) WalkTransform = FTransform(GetControlRotation(), P->GetActorLocation());
		Focused = Machine;
		CamTargetLoc = Machine->GetViewLocation();
		CamTargetRot = (Machine->GetFocusLocation() - CamTargetLoc).Rotation();
		if (AP) AP->bLockHeight = false;
		if (P) P->SetActorEnableCollision(false);
	}
	else if (Focused.IsValid())
	{
		Focused = nullptr;
		CamTargetLoc = WalkTransform.GetLocation();
		CamTargetRot = WalkTransform.Rotator();
		if (P) P->SetActorEnableCollision(true);
	}
	CamBlend = 0.f;
	SetUIMode(bUIMode);
}

void AAcademiaPlayerController::TeleportTo(AInspectionMachine* Machine)
{
	APawn* P = GetPawn();
	if (!P || !Machine) return;
	FVector L = Machine->GetFrontLocation(150.f);
	L.Z = AAcademiaPawn::EyeHeight;
	P->SetActorLocation(L, false, nullptr, ETeleportType::TeleportPhysics);
	SetControlRotation((Machine->GetFocusLocation() - L).Rotation());
}

void AAcademiaPlayerController::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Transición suave de cámara al enfocar o soltar una máquina
	if (CamBlend < 1.f)
	{
		if (APawn* P = GetPawn())
		{
			CamBlend = FMath::Min(1.f, CamBlend + DeltaSeconds * 2.2f);
			const float A = FMath::InterpEaseInOut(0.f, 1.f, CamBlend, 2.f);
			P->SetActorLocation(FMath::Lerp(P->GetActorLocation(), CamTargetLoc, A), false, nullptr, ETeleportType::TeleportPhysics);
			SetControlRotation(FMath::RInterpTo(GetControlRotation(), CamTargetRot, DeltaSeconds, 6.f + 20.f * A));
			if (CamBlend >= 1.f)
			{
				SetControlRotation(CamTargetRot);
				if (!Focused.IsValid()) if (AAcademiaPawn* AP = Cast<AAcademiaPawn>(P)) AP->bLockHeight = true;
			}
		}
	}

	if (!Shell.IsValid()) return;
	if (Focused.IsValid())
	{
		UpdateHover();
		return;
	}
	// Indicador contextual y evento "llegaste a la máquina" para las misiones
	AInspectionMachine* Near = bUIMode ? nullptr : GetNearestMachine();
	if (Near != LastNear.Get())
	{
		LastNear = Near;
		if (Near)
		{
			Shell->SetHint(FString::Printf(TEXT("E: usar %s"), *Near->GetStation().Name));
			if (UAcademiaGameInstance* GI = UAcademiaGameInstance::Get(this)) GI->NotifyEvent(EAcademiaEvent::ReachedMachine, Near->GetMachineId());
		}
		else
		{
			Shell->SetHint(bUIMode ? FString() : TEXT("WASD: caminar · Shift: correr · E: usar · Tab: menú"));
		}
	}
}

void AAcademiaPlayerController::UpdateHover()
{
	AInspectionMachine* M = Focused.Get();
	if (!M || !Shell.IsValid() || !Shell->OnPartHovered) return;
	FHitResult Hit;
	FString Part;
	if (GetHitResultUnderCursor(ECC_Visibility, true, Hit) && Hit.GetActor() == M)
		Part = M->PartFromComponent(Hit.GetComponent());
	Shell->OnPartHovered(Part);
}

void AAcademiaPlayerController::OnClick()
{
	AInspectionMachine* M = Focused.Get();
	if (!M || !Shell.IsValid() || !Shell->OnPartPicked) return;
	FHitResult Hit;
	if (GetHitResultUnderCursor(ECC_Visibility, true, Hit) && Hit.GetActor() == M)
	{
		const FString Part = M->PartFromComponent(Hit.GetComponent());
		if (!Part.IsEmpty()) Shell->OnPartPicked(Part);
	}
}

void AAcademiaPlayerController::OnInteract()
{
	if (!Shell.IsValid()) return;
	if (Shell->IsDialogOpen()) { Shell->AdvanceDialog(); return; }
	if (bUIMode) return;
	if (AInspectionMachine* M = GetNearestMachine())
	{
		Shell->ShowMachineHub(M->GetMachineId());
		return;
	}
	// Hablar con la mentora si está cerca
	if (AMentorActor* Mentor = GetMentor())
	{
		if (GetPawn() && FVector::Dist2D(Mentor->GetActorLocation(), GetPawn()->GetActorLocation()) < 300.f)
		{
			Shell->ShowCareer();
		}
	}
}

void AAcademiaPlayerController::OnMenu()
{
	if (!Shell.IsValid()) return;
	if (Shell->IsDialogOpen()) { Shell->AdvanceDialog(); return; }
	if (Shell->IsViewOpen()) Shell->Back();
	else Shell->ShowMainMenu();
}
