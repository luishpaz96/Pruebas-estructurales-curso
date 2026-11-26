#include "InspectionMachine.h"

#include "Components/StaticMeshComponent.h"
#include "Components/TextRenderComponent.h"
#include "Components/SceneComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	// Mallas básicas del motor (100 cm). Se guardan en el CDO para que se cocinen al empaquetar.
	UStaticMesh* GCube = nullptr;
	UStaticMesh* GCyl = nullptr;
	UStaticMesh* GSphere = nullptr;
	UMaterialInterface* GMat = nullptr;

	const FLinearColor Body(0.82f, 0.84f, 0.86f);
	const FLinearColor Dark(0.08f, 0.09f, 0.1f);
	const FLinearColor Steel(0.55f, 0.58f, 0.62f);
	const FLinearColor Glass(0.12f, 0.16f, 0.2f);
	const FLinearColor Yellow(1.f, 0.78f, 0.1f);
	const FLinearColor Red(0.85f, 0.08f, 0.08f);
	const FLinearColor Green(0.08f, 0.33f, 0.18f);
}

AInspectionMachine::AInspectionMachine()
{
	PrimaryActorTick.bCanEverTick = true;
	Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	RootComponent = Root;

	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cube(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cyl(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Sph(TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	static ConstructorHelpers::FObjectFinder<UMaterialInterface> Mat(TEXT("/Engine/BasicShapes/BasicShapeMaterial.BasicShapeMaterial"));
	if (Cube.Succeeded()) GCube = Cube.Object;
	if (Cyl.Succeeded()) GCyl = Cyl.Object;
	if (Sph.Succeeded()) GSphere = Sph.Object;
	if (Mat.Succeeded()) GMat = Mat.Object;
}

// ------------------------------------------------------------------ Primitivas

USceneComponent* AInspectionMachine::AddGroup(const FString& Part, USceneComponent* Parent, FVector LocCm)
{
	USceneComponent* G = NewObject<USceneComponent>(this);
	G->SetupAttachment(Parent ? Parent : Root.Get());
	G->SetRelativeLocation(LocCm);
	G->RegisterComponent();
	if (!Part.IsEmpty())
	{
		G->ComponentTags.Add(FName(*Part));
		PartRoots.Add(Part, G);
	}
	return G;
}

static UStaticMeshComponent* MakeMesh(AInspectionMachine* Owner, UStaticMesh* Mesh, USceneComponent* Parent, const FVector& Loc, const FVector& Scale, const FRotator& Rot)
{
	UStaticMeshComponent* C = NewObject<UStaticMeshComponent>(Owner);
	C->SetStaticMesh(Mesh);
	C->SetupAttachment(Parent);
	C->SetRelativeLocation(Loc);
	C->SetRelativeRotation(Rot);
	C->SetRelativeScale3D(Scale);
	C->SetCollisionProfileName(TEXT("BlockAll"));
	C->SetMobility(EComponentMobility::Movable);
	C->RegisterComponent();
	return C;
}

UStaticMeshComponent* AInspectionMachine::AddBox(const FString& Part, USceneComponent* Parent, FVector CenterCm, FVector SizeCm, FLinearColor Color, FRotator Rot)
{
	UStaticMeshComponent* C = MakeMesh(this, GCube, Parent ? Parent : Root.Get(), CenterCm, SizeCm / 100.f, Rot);
	UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(GMat, this);
	if (M) { M->SetVectorParameterValue(TEXT("Color"), Color); C->SetMaterial(0, M); }
	if (!Part.IsEmpty()) C->ComponentTags.Add(FName(*Part));
	Meshes.Add({ C, M, Color, Part });
	return C;
}

UStaticMeshComponent* AInspectionMachine::AddCyl(const FString& Part, USceneComponent* Parent, FVector CenterCm, float DiameterCm, float HeightCm, FLinearColor Color, FRotator Rot)
{
	UStaticMeshComponent* C = MakeMesh(this, GCyl, Parent ? Parent : Root.Get(), CenterCm, FVector(DiameterCm, DiameterCm, HeightCm) / 100.f, Rot);
	UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(GMat, this);
	if (M) { M->SetVectorParameterValue(TEXT("Color"), Color); C->SetMaterial(0, M); }
	if (!Part.IsEmpty()) C->ComponentTags.Add(FName(*Part));
	Meshes.Add({ C, M, Color, Part });
	return C;
}

UStaticMeshComponent* AInspectionMachine::AddSphere(const FString& Part, USceneComponent* Parent, FVector CenterCm, float DiameterCm, FLinearColor Color)
{
	UStaticMeshComponent* C = MakeMesh(this, GSphere, Parent ? Parent : Root.Get(), CenterCm, FVector(DiameterCm) / 100.f, FRotator::ZeroRotator);
	UMaterialInstanceDynamic* M = UMaterialInstanceDynamic::Create(GMat, this);
	if (M) { M->SetVectorParameterValue(TEXT("Color"), Color); C->SetMaterial(0, M); }
	if (!Part.IsEmpty()) C->ComponentTags.Add(FName(*Part));
	Meshes.Add({ C, M, Color, Part });
	return C;
}

UTextRenderComponent* AInspectionMachine::AddLabel(const FString& Text, FVector LocCm, float SizeCm, FLinearColor Color, FRotator Rot)
{
	UTextRenderComponent* T = NewObject<UTextRenderComponent>(this);
	T->SetupAttachment(Root);
	T->SetRelativeLocation(LocCm);
	T->SetRelativeRotation(Rot);
	T->SetText(FText::FromString(Text));
	T->SetWorldSize(SizeCm);
	T->SetTextRenderColor(Color.ToFColor(true));
	T->SetHorizontalAlignment(EHTA_Center);
	T->SetVerticalAlignment(EVRTA_TextCenter);
	T->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	T->RegisterComponent();
	return T;
}

// ------------------------------------------------------------------ Construcción

void AInspectionMachine::Build(const FLineStation& InStation, const FCourseMachine* Machine)
{
	Station = InStation;
	const FVector S = Station.SizeMM / 10.f;           // cm: X = ancho (sentido del transportador), Y = fondo, Z = alto
	const float Conv = Station.ConveyorHeightMM / 10.f;
	const FString& T = Station.Template;

	if (T == TEXT("reflow")) BuildReflow(S, Conv);
	else if (T == TEXT("printer")) BuildPrinter(S, Conv);
	else if (T == TEXT("pnp")) BuildPnP(S, Conv);
	else if (T == TEXT("axi")) BuildAXI(S, Conv);
	else if (T == TEXT("ict")) BuildICT(S, Conv);
	else if (T == TEXT("aoi") || T == TEXT("spi")) BuildAOI(S, Conv, T == TEXT("spi"));
	else
	{
		// Cargador / descargador / genérico: gabinete con magazine
		BuildCabinet(S, Conv);
		BuildConveyor(S, Conv, 4.f);
		AddBox(TEXT(""), Root, FVector(0, 0, Conv + 30), FVector(S.X * 0.55f, S.Y * 0.6f, 55), Dark);
		for (int32 i = 0; i < 8; ++i) AddBox(TEXT(""), Root, FVector(0, -S.Y * 0.3f - 0.5f, Conv + 6 + i * 6.5f), FVector(S.X * 0.5f, 1, 0.6f), Steel);
		BuildCommon(S, Conv);
	}

	// Rótulo con el nombre y las medidas reales
	const FString Dims = FString::Printf(TEXT("%.0f × %.0f × %.0f mm%s"), Station.SizeMM.X, Station.SizeMM.Y, Station.SizeMM.Z, Station.bApprox ? TEXT(" (aprox.)") : TEXT(""));
	AddLabel(Station.Name, FVector(0, -S.Y / 2 - 2, S.Z + 28), 13.f, Station.Accent, FRotator(0, -90, 0));
	AddLabel(Dims, FVector(0, -S.Y / 2 - 2, S.Z + 14), 7.f, FLinearColor(0.8f, 0.82f, 0.85f), FRotator(0, -90, 0));
}

void AInspectionMachine::BuildCabinet(const FVector& S, float Conv)
{
	// Base inferior (hasta el transportador) con zócalo negro y niveladores
	AddBox(TEXT(""), Root, FVector(0, 0, 6), FVector(S.X - 4, S.Y - 4, 12), Dark);
	AddBox(TEXT(""), Root, FVector(0, 0, 12 + (Conv - 22) / 2), FVector(S.X, S.Y, Conv - 22), Station.Color);
	for (int32 i = 0; i < 4; ++i)
		AddCyl(TEXT(""), Root, FVector((i % 2 ? 1 : -1) * (S.X / 2 - 8), (i / 2 ? 1 : -1) * (S.Y / 2 - 8), 3), 6, 6, Steel);
	// Franja de color de la marca
	AddBox(TEXT(""), Root, FVector(0, -S.Y / 2 - 0.4f, Conv - 16), FVector(S.X, 1, 5), Station.Accent);
	// PC de visión y UPS (compartimento frontal inferior)
	UStaticMeshComponent* Pc = AddBox(TEXT("pc_ups"), AddGroup(TEXT("pc_ups"), Root, FVector::ZeroVector), FVector(-S.X * 0.22f, -S.Y / 2 - 0.6f, 45), FVector(S.X * 0.38f, 1.2f, 55), FLinearColor(0.7f, 0.72f, 0.75f));
	(void)Pc;
	AddBox(TEXT("pc_ups"), PartRoots[TEXT("pc_ups")].Get(), FVector(-S.X * 0.22f + S.X * 0.15f, -S.Y / 2 - 1.4f, 45), FVector(2, 1, 10), Dark);
}

void AInspectionMachine::BuildConveyor(const FVector& S, float Conv, float ExtraCm)
{
	const float Len = S.X + ExtraCm * 2;
	USceneComponent* C = AddGroup(TEXT("conveyor"), Root, FVector(0, 0, Conv));
	const float Gap = FMath::Min(S.Y * 0.32f, 46.f);   // ancho de riel ~ tarjeta de hasta 460 mm
	AddBox(TEXT("conveyor"), C, FVector(0, -Gap / 2 - 2, -3), FVector(Len, 3, 7), Steel);
	AddBox(TEXT("conveyor"), C, FVector(0, Gap / 2 + 2, -3), FVector(Len, 3, 7), Steel);
	USceneComponent* B = AddGroup(TEXT("belt"), Root, FVector(0, 0, Conv));
	AddBox(TEXT("belt"), B, FVector(0, -Gap / 2 - 0.2f, -0.6f), FVector(Len, 1.4f, 0.8f), Dark);
	AddBox(TEXT("belt"), B, FVector(0, Gap / 2 + 0.2f, -0.6f), FVector(Len, 1.4f, 0.8f), Dark);
	// Ajuste de ancho (manivela al frente)
	USceneComponent* R = AddGroup(TEXT("rail_width"), Root, FVector(S.X / 2 - 12, -S.Y / 2 - 3, Conv - 8));
	AddCyl(TEXT("rail_width"), R, FVector::ZeroVector, 7, 3, Steel, FRotator(0, 0, 90));
	AddCyl(TEXT("rail_width"), R, FVector(2.5f, -2.5f, 0), 1.5f, 5, Dark, FRotator(0, 0, 90));
	// Tarjeta que avanza
	USceneComponent* P = AddGroup(TEXT("pcb"), Root, FVector(-S.X / 2, 0, Conv + 0.3f));
	AddBox(TEXT("pcb"), P, FVector::ZeroVector, FVector(18, Gap - 1, 0.16f * 10.f / 10.f + 0.2f), Green);
	for (int32 i = 0; i < 6; ++i) AddBox(TEXT("pcb"), P, FVector(-6 + (i % 3) * 6, -6 + (i / 3) * 10, 0.5f), FVector(2.5f, 2.5f, 0.6f), Dark);
	Board = P;
}

void AInspectionMachine::BuildCommon(const FVector& S, float Conv)
{
	// Paro de emergencia al frente
	USceneComponent* E = AddGroup(TEXT("emergency_stop"), Root, FVector(-S.X / 2 + 15, -S.Y / 2 - 2, Conv + 18));
	AddBox(TEXT("emergency_stop"), E, FVector::ZeroVector, FVector(9, 4, 9), Yellow);
	AddCyl(TEXT("emergency_stop"), E, FVector(0, -3.5f, 0), 6, 3, Red, FRotator(0, 0, 90));
	// Torre de luces
	USceneComponent* Tw = AddGroup(TEXT("tower_light"), Root, FVector(S.X / 2 - 12, S.Y / 2 - 15, S.Z));
	AddCyl(TEXT("tower_light"), Tw, FVector(0, 0, 10), 2.5f, 20, Steel);
	const FLinearColor LampCol[3] = { FLinearColor(0.6f, 0.05f, 0.05f), FLinearColor(0.6f, 0.4f, 0.03f), FLinearColor(0.05f, 0.5f, 0.15f) };
	Lamps.Reset();
	for (int32 i = 0; i < 3; ++i)
	{
		UStaticMeshComponent* L = AddCyl(TEXT("tower_light"), Tw, FVector(0, 0, 44 - i * 7.5f), 7, 7, LampCol[i]);
		Lamps.Add(Cast<UMaterialInstanceDynamic>(L->GetMaterial(0)));
	}
	// Filtros (lado derecho) y ventilador (atrás)
	USceneComponent* F = AddGroup(TEXT("filter"), Root, FVector(S.X / 2 + 0.8f, 0, Conv * 0.5f));
	AddBox(TEXT("filter"), F, FVector::ZeroVector, FVector(1.5f, S.Y * 0.45f, Conv * 0.45f), FLinearColor(0.55f, 0.64f, 0.71f));
	for (int32 i = 0; i < 6; ++i) AddBox(TEXT("filter"), F, FVector(0.6f, 0, -Conv * 0.18f + i * Conv * 0.07f), FVector(1, S.Y * 0.43f, 0.8f), Dark);
	USceneComponent* Fan = AddGroup(TEXT("fan"), Root, FVector(S.X * 0.25f, S.Y / 2 + 1.5f, Conv * 0.6f));
	AddCyl(TEXT("fan"), Fan, FVector::ZeroVector, 30, 3, Dark, FRotator(0, 0, 90));
	USceneComponent* Bl = AddGroup(TEXT("fan"), Fan, FVector(0, 2, 0));
	for (int32 i = 0; i < 5; ++i) AddBox(TEXT("fan"), Bl, FVector::ZeroVector, FVector(4, 0.6f, 24), Steel, FRotator(i * 36.f, 0, 0));
	Blades = Bl;
	PartRoots.Add(TEXT("fan"), Fan);
	// Neumática: regulador con manómetro (lado izquierdo)
	USceneComponent* Pn = AddGroup(TEXT("pneumatic"), Root, FVector(-S.X / 2 - 4, -S.Y * 0.25f, Conv - 25));
	AddCyl(TEXT("pneumatic"), Pn, FVector::ZeroVector, 7, 18, Steel);
	AddCyl(TEXT("pneumatic"), Pn, FVector(-3.5f, 0, 6), 7, 1.5f, FLinearColor::White, FRotator(0, 90, 90));
	// Monitor, teclado y brazo al frente
	AddBox(TEXT(""), Root, FVector(S.X / 2 - 25, -S.Y / 2 - 22, Conv + 12), FVector(40, 22, 2), Dark);
	AddBox(TEXT(""), Root, FVector(S.X / 2 - 25, -S.Y / 2 - 12, Conv + 32), FVector(3, 3, 40), Steel);
	AddBox(TEXT(""), Root, FVector(S.X / 2 - 25, -S.Y / 2 - 16, Conv + 58), FVector(56, 3, 34), Dark);
	AddBox(TEXT(""), Root, FVector(S.X / 2 - 25, -S.Y / 2 - 17.6f, Conv + 58), FVector(52, 0.4f, 30), FLinearColor(Station.Accent.R * 0.35f, Station.Accent.G * 0.35f, Station.Accent.B * 0.35f));
}

void AInspectionMachine::BuildAOI(const FVector& S, float Conv, bool bSPI)
{
	BuildCabinet(S, Conv);
	BuildConveyor(S, Conv, 3.f);
	const float HoodBottom = Conv - 10.f;
	const float HoodTop = S.Z - 55.f;   // la torre de luces y el techo completan la altura total
	// Cubierta superior: paredes laterales y trasera, techo
	AddBox(TEXT(""), Root, FVector(-S.X / 2 + 2, 0, (HoodBottom + HoodTop) / 2), FVector(4, S.Y, HoodTop - HoodBottom), Station.Color);
	AddBox(TEXT(""), Root, FVector(S.X / 2 - 2, 0, (HoodBottom + HoodTop) / 2), FVector(4, S.Y, HoodTop - HoodBottom), Station.Color);
	AddBox(TEXT(""), Root, FVector(0, S.Y / 2 - 2, (HoodBottom + HoodTop) / 2), FVector(S.X, 4, HoodTop - HoodBottom), Station.Color);
	AddBox(TEXT(""), Root, FVector(0, 0, HoodTop + 22), FVector(S.X, S.Y, 44), Station.Color);
	AddBox(TEXT(""), Root, FVector(0, -S.Y / 2 - 0.4f, HoodTop + 30), FVector(S.X * 0.7f, 1, 8), Station.Accent);
	// Puerta frontal con ventana (gira hacia arriba desde la bisagra superior)
	USceneComponent* D = AddGroup(TEXT("door"), Root, FVector(0, -S.Y / 2, HoodTop));
	const float DoorH = HoodTop - HoodBottom;
	AddBox(TEXT("door"), D, FVector(0, 0, -DoorH / 2), FVector(S.X - 8, 3, DoorH), Station.Color);
	AddBox(TEXT("door"), D, FVector(0, -1.7f, -DoorH * 0.45f), FVector(S.X * 0.72f, 0.6f, DoorH * 0.6f), Glass);
	AddBox(TEXT("door"), D, FVector(0, -3.5f, -DoorH + 8), FVector(S.X * 0.3f, 3, 2.5f), Steel);
	Door = D;
	// Interlocks en las esquinas de la puerta
	USceneComponent* I = AddGroup(TEXT("interlock"), Root, FVector::ZeroVector);
	AddBox(TEXT("interlock"), I, FVector(-S.X / 2 + 7, -S.Y / 2 + 4, HoodTop - 6), FVector(4, 3, 6), Red);
	AddBox(TEXT("interlock"), I, FVector(S.X / 2 - 7, -S.Y / 2 + 4, HoodTop - 6), FVector(4, 3, 6), Red);

	// Gantry (puente en Y) y cabezal óptico que corre en X
	const float GZ = Conv + FMath::Min(55.f, (HoodTop - Conv) * 0.55f);
	USceneComponent* G = AddGroup(TEXT("gantry"), Root, FVector(0, 0, GZ));
	AddBox(TEXT("gantry"), G, FVector(0, -S.Y * 0.3f, 0), FVector(S.X - 16, 8, 8), Steel);
	AddBox(TEXT("gantry"), G, FVector(0, S.Y * 0.3f, 0), FVector(S.X - 16, 8, 8), Steel);
	AddBox(TEXT("gantry"), G, FVector(0, 0, 4), FVector(10, S.Y * 0.6f, 6), FLinearColor(0.3f, 0.32f, 0.35f));
	USceneComponent* H = AddGroup(TEXT(""), G, FVector(0, 0, -6));
	Head = H;
	HeadTravel = S.X / 2 - 22.f;
	USceneComponent* Cam = AddGroup(TEXT("camera"), H, FVector::ZeroVector);
	AddBox(TEXT("camera"), Cam, FVector(0, 0, 8), FVector(16, 16, 22), Dark);
	AddCyl(TEXT("camera"), Cam, FVector(0, 0, -6), 8, 10, FLinearColor(0.15f, 0.15f, 0.17f));
	USceneComponent* Lr = AddGroup(TEXT("light_ring"), H, FVector(0, 0, -12));
	AddCyl(TEXT("light_ring"), Lr, FVector::ZeroVector, 20, 2.5f, FLinearColor(0.85f, 0.85f, 0.9f));
	const int32 NProj = Station.MachineId == TEXT("aoi_v510") ? 4 : 8;   // V510: 4 proyectores PSP; Koh Young: 8 moiré
	USceneComponent* Pj = AddGroup(TEXT("projector"), H, FVector::ZeroVector);
	for (int32 i = 0; i < NProj; ++i)
	{
		const float A = 2.f * PI * i / NProj;
		AddCyl(TEXT("projector"), Pj, FVector(FMath::Cos(A) * 15, FMath::Sin(A) * 15, -2), 4.5f, 12, FLinearColor(0.25f, 0.27f, 0.3f), FRotator(25.f, FMath::RadiansToDegrees(A), 0.f));
	}
	// Blanco de calibración
	USceneComponent* Ct = AddGroup(TEXT("calibration_target"), Root, FVector(S.X / 2 - 22, S.Y * 0.18f, Conv + 1));
	AddBox(TEXT("calibration_target"), Ct, FVector::ZeroVector, FVector(14, 10, 1), FLinearColor(0.85f, 0.88f, 0.9f));
	for (int32 i = 0; i < 9; ++i) AddCyl(TEXT("calibration_target"), Ct, FVector((i % 3 - 1) * 4, (i / 3 - 1) * 3, 0.6f), 1, 0.3f, Dark);
	if (bSPI)
	{
		AddLabel(TEXT("SPI 3D"), FVector(0, -S.Y / 2 - 4, HoodTop + 30), 6.f, FLinearColor::White, FRotator(0, -90, 0));
	}
	BuildCommon(S, Conv);
}

void AInspectionMachine::BuildAXI(const FVector& S, float Conv)
{
	// Gabinete blindado de una pieza (plomo y acero), puertas frontales con interlocks
	AddBox(TEXT(""), Root, FVector(0, 0, 6), FVector(S.X - 4, S.Y - 4, 12), Dark);
	AddBox(TEXT(""), Root, FVector(0, 0, 12 + (S.Z - 12 - 40) / 2), FVector(S.X, S.Y, S.Z - 52), Station.Color);
	AddBox(TEXT(""), Root, FVector(0, 0, S.Z - 20), FVector(S.X - 10, S.Y - 10, 40), FLinearColor(0.7f, 0.72f, 0.74f));
	AddBox(TEXT(""), Root, FVector(0, -S.Y / 2 - 0.4f, S.Z - 70), FVector(S.X, 1, 6), Station.Accent);
	// Compuertas blindadas de entrada y salida del transportador
	AddBox(TEXT("conveyor"), Root, FVector(-S.X / 2 - 1, 0, Conv + 5), FVector(2, 50, 14), Dark);
	AddBox(TEXT("conveyor"), Root, FVector(S.X / 2 + 1, 0, Conv + 5), FVector(2, 50, 14), Dark);
	BuildConveyor(S, Conv, 6.f);
	// Puerta frontal (se abre hacia arriba) con mirilla de vidrio plomado
	const float DoorTop = S.Z - 60.f, DoorBottom = Conv - 20.f;
	USceneComponent* D = AddGroup(TEXT("door"), Root, FVector(0, -S.Y / 2, DoorTop));
	AddBox(TEXT("door"), D, FVector(0, -1.5f, -(DoorTop - DoorBottom) / 2), FVector(S.X * 0.62f, 3, DoorTop - DoorBottom), FLinearColor(0.75f, 0.77f, 0.8f));
	AddBox(TEXT("door"), D, FVector(0, -3.2f, -(DoorTop - DoorBottom) * 0.4f), FVector(S.X * 0.3f, 0.5f, (DoorTop - DoorBottom) * 0.3f), Glass);
	Door = D;
	USceneComponent* I = AddGroup(TEXT("interlock"), Root, FVector::ZeroVector);
	AddBox(TEXT("interlock"), I, FVector(-S.X * 0.31f - 4, -S.Y / 2 - 2, DoorTop - 8), FVector(4, 3, 7), Red);
	AddBox(TEXT("interlock"), I, FVector(S.X * 0.31f + 4, -S.Y / 2 - 2, DoorTop - 8), FVector(4, 3, 7), Red);
	// Letrero de radiación
	AddBox(TEXT(""), Root, FVector(-S.X * 0.4f, -S.Y / 2 - 0.6f, S.Z - 95), FVector(22, 1, 22), Yellow);
	AddLabel(TEXT("RAYOS X"), FVector(-S.X * 0.4f, -S.Y / 2 - 1.4f, S.Z - 95), 5.f, FLinearColor(0.05f, 0.05f, 0.05f), FRotator(0, -90, 0));
	// Tubo de rayos X arriba y detector debajo de la tarjeta (visibles a través de la mirilla)
	USceneComponent* Xs = AddGroup(TEXT("xray_source"), Root, FVector(0, 0, Conv + 45));
	AddCyl(TEXT("xray_source"), Xs, FVector(0, 0, 10), 22, 30, FLinearColor(0.35f, 0.37f, 0.4f));
	AddCyl(TEXT("xray_source"), Xs, FVector(0, 0, -8), 8, 8, Yellow);
	USceneComponent* De = AddGroup(TEXT("detector"), Root, FVector(0, 0, Conv - 30));
	AddBox(TEXT("detector"), De, FVector::ZeroVector, FVector(40, 40, 6), Dark);
	AddBox(TEXT("detector"), De, FVector(0, 0, 3.2f), FVector(36, 36, 0.5f), FLinearColor(0.2f, 0.35f, 0.5f));
	Head = De;
	HeadTravel = 15.f;
	// Blanco de calibración (cupón)
	USceneComponent* Ct = AddGroup(TEXT("calibration_target"), Root, FVector(S.X * 0.3f, S.Y * 0.15f, Conv + 1));
	AddBox(TEXT("calibration_target"), Ct, FVector::ZeroVector, FVector(12, 8, 1), FLinearColor(0.85f, 0.88f, 0.9f));
	// PC y UPS (gabinete lateral)
	USceneComponent* Pc = AddGroup(TEXT("pc_ups"), Root, FVector::ZeroVector);
	AddBox(TEXT("pc_ups"), Pc, FVector(-S.X / 2 + S.X * 0.12f, -S.Y / 2 - 0.6f, 40), FVector(S.X * 0.2f, 1.2f, 50), FLinearColor(0.68f, 0.7f, 0.73f));
	BuildCommon(S, Conv);
}

void AInspectionMachine::BuildICT(const FVector& S, float Conv)
{
	// HP3070: gabinete del testhead con la cabeza de pruebas inclinada al frente y fixture al vacío encima
	AddBox(TEXT(""), Root, FVector(0, 0, 6), FVector(S.X - 4, S.Y - 4, 12), Dark);
	AddBox(TEXT(""), Root, FVector(0, S.Y * 0.1f, 12 + (Conv - 22) / 2), FVector(S.X, S.Y * 0.8f, Conv - 22), Station.Color);
	AddBox(TEXT(""), Root, FVector(0, S.Y / 2 - 20, (Conv + S.Z) / 2), FVector(S.X, 40, S.Z - Conv), FLinearColor(0.5f, 0.53f, 0.58f));
	AddBox(TEXT(""), Root, FVector(0, -S.Y / 2 + S.Y * 0.1f - 0.4f, Conv - 16), FVector(S.X, 1, 5), Station.Accent);
	// Testhead
	AddBox(TEXT(""), Root, FVector(0, -S.Y * 0.05f, Conv - 6), FVector(S.X * 0.86f, S.Y * 0.62f, 12), FLinearColor(0.2f, 0.22f, 0.25f));
	// Fixture
	USceneComponent* Fx = AddGroup(TEXT("fixture"), Root, FVector(0, -S.Y * 0.05f, Conv + 4));
	AddBox(TEXT("fixture"), Fx, FVector::ZeroVector, FVector(S.X * 0.62f, S.Y * 0.48f, 9), FLinearColor(0.1f, 0.28f, 0.55f));
	AddBox(TEXT("fixture"), Fx, FVector(0, 0, 5), FVector(S.X * 0.5f, S.Y * 0.38f, 1), FLinearColor(0.85f, 0.75f, 0.45f));
	USceneComponent* Pr = AddGroup(TEXT("probes"), Root, FVector(0, -S.Y * 0.05f, Conv + 10));
	for (int32 i = 0; i < 48; ++i)
		AddCyl(TEXT("probes"), Pr, FVector((i % 8 - 3.5f) * 4.5f, (i / 8 - 2.5f) * 4.5f, 0), 0.6f, 2.5f, FLinearColor(0.9f, 0.75f, 0.3f));
	USceneComponent* P = AddGroup(TEXT("pcb"), Root, FVector(0, -S.Y * 0.05f, Conv + 12));
	AddBox(TEXT("pcb"), P, FVector::ZeroVector, FVector(30, 20, 0.3f), Green);
	Board = nullptr;
	// Tapa (gate) del fixture que baja al hacer vacío: usamos la "puerta"
	USceneComponent* D = AddGroup(TEXT("door"), Root, FVector(0, S.Y * 0.2f, Conv + 14));
	AddBox(TEXT("door"), D, FVector(0, -S.Y * 0.24f, 0), FVector(S.X * 0.62f, S.Y * 0.48f, 2), FLinearColor(0.85f, 0.87f, 0.9f));
	Door = D;
	// Vacío: bomba y manguera
	USceneComponent* V = AddGroup(TEXT("vacuum"), Root, FVector(-S.X / 2 - 14, 0, 18));
	AddBox(TEXT("vacuum"), V, FVector::ZeroVector, FVector(24, 30, 36), FLinearColor(0.3f, 0.32f, 0.36f));
	AddCyl(TEXT("vacuum"), V, FVector(8, 0, 35), 4, 40, Dark);
	AddCyl(TEXT("vacuum"), V, FVector(0, 0, 21), 10, 3, FLinearColor::White, FRotator(0, 0, 90));
	USceneComponent* I = AddGroup(TEXT("interlock"), Root, FVector::ZeroVector);
	AddBox(TEXT("interlock"), I, FVector(S.X * 0.33f, -S.Y * 0.3f, Conv + 6), FVector(4, 3, 6), Red);
	// PC/estación (controller)
	USceneComponent* Pc = AddGroup(TEXT("pc_ups"), Root, FVector::ZeroVector);
	AddBox(TEXT("pc_ups"), Pc, FVector(S.X / 2 + 30, 0, 45), FVector(40, 60, 90), Dark);
	AddLabel(TEXT("Keysight i3070"), FVector(0, S.Y / 2 - 41, S.Z - 25), 8.f, FLinearColor::White, FRotator(0, -90, 0));
	BuildCommon(S, Conv);
}

void AInspectionMachine::BuildPrinter(const FVector& S, float Conv)
{
	BuildCabinet(S, Conv);
	BuildConveyor(S, Conv, 3.f);
	AddBox(TEXT(""), Root, FVector(0, 0, (Conv + S.Z - 30) / 2 + 5), FVector(S.X, S.Y, S.Z - Conv - 30), Station.Color);
	AddBox(TEXT(""), Root, FVector(0, -S.Y / 2 - 0.8f, Conv + (S.Z - Conv - 30) * 0.55f), FVector(S.X * 0.7f, 1, (S.Z - Conv - 30) * 0.5f), Glass);
	AddBox(TEXT(""), Root, FVector(0, -S.Y / 2 - 0.4f, S.Z - 40), FVector(S.X, 1, 6), Station.Accent);
	AddBox(TEXT(""), Root, FVector(0, 0, S.Z - 15), FVector(S.X, S.Y, 30), FLinearColor(0.7f, 0.72f, 0.75f));
	BuildCommon(S, Conv);
}

void AInspectionMachine::BuildPnP(const FVector& S, float Conv)
{
	BuildCabinet(S, Conv);
	BuildConveyor(S, Conv, 3.f);
	// Bancos de alimentadores al frente y atrás
	for (int32 Side = -1; Side <= 1; Side += 2)
	{
		AddBox(TEXT(""), Root, FVector(0, Side * (S.Y / 2 - 20), Conv - 5), FVector(S.X * 0.85f, 40, 30), FLinearColor(0.25f, 0.27f, 0.3f));
		for (int32 i = 0; i < 20; ++i)
			AddCyl(TEXT(""), Root, FVector(-S.X * 0.4f + i * S.X * 0.042f, Side * (S.Y / 2 + 2), Conv + 8), 18, 1.2f, FLinearColor(0.1f, 0.1f, 0.12f), FRotator(0, 0, 90));
	}
	AddBox(TEXT(""), Root, FVector(0, 0, (Conv + S.Z) / 2 + 12), FVector(S.X, S.Y * 0.7f, S.Z - Conv - 24), Station.Color);
	AddBox(TEXT(""), Root, FVector(0, -S.Y * 0.35f - 0.6f, (Conv + S.Z) / 2 + 12), FVector(S.X * 0.8f, 1, (S.Z - Conv) * 0.5f), Glass);
	AddBox(TEXT(""), Root, FVector(0, -S.Y * 0.35f - 1, S.Z - 20), FVector(S.X, 1, 6), Station.Accent);
	BuildCommon(S, Conv);
}

void AInspectionMachine::BuildReflow(const FVector& S, float Conv)
{
	BuildCabinet(S, Conv);
	BuildConveyor(S, Conv, 5.f);
	AddBox(TEXT(""), Root, FVector(0, 0, Conv + 22), FVector(S.X, S.Y, 44), Station.Color);
	const int32 Zones = 10;
	for (int32 i = 0; i < Zones; ++i)
	{
		const float X = -S.X / 2 + S.X * (i + 0.5f) / Zones;
		const float Heat = float(i) / (Zones - 1);
		AddBox(TEXT(""), Root, FVector(X, -S.Y / 2 - 0.5f, Conv + 22), FVector(S.X / Zones - 4, 1, 30), FLinearColor(0.6f + Heat * 0.3f, 0.6f - Heat * 0.35f, 0.6f - Heat * 0.5f));
	}
	AddBox(TEXT(""), Root, FVector(0, 0, (S.Z + Conv + 44) / 2), FVector(S.X * 0.9f, S.Y * 0.9f, S.Z - Conv - 44), FLinearColor(0.72f, 0.74f, 0.77f));
	BuildCommon(S, Conv);
}

// ------------------------------------------------------------------ Piezas e interacción

TArray<FString> AInspectionMachine::GetPartIds() const
{
	TArray<FString> Out;
	PartRoots.GetKeys(Out);
	Out.Sort();
	return Out;
}

bool AInspectionMachine::HasPart(const FString& Part) const
{
	return PartRoots.Contains(Part);
}

FString AInspectionMachine::PartFromComponent(const UPrimitiveComponent* Comp) const
{
	if (!Comp || Comp->GetOwner() != this) return FString();
	for (const FMeshInfo& M : Meshes)
		if (M.Mesh.Get() == Comp) return M.Part;
	return FString();
}

void AInspectionMachine::SetPartColor(const FString& Part, FLinearColor Color)
{
	for (const FMeshInfo& M : Meshes)
		if (M.Part == Part && M.Mat.IsValid()) M.Mat->SetVectorParameterValue(TEXT("Color"), Color);
}

void AInspectionMachine::HighlightPart(const FString& Part, FLinearColor Color, float Seconds)
{
	HighlightUntil.Add(Part, Time + Seconds);
	HighlightColor.Add(Part, Color);
}

void AInspectionMachine::SetHover(const FString& Part)
{
	HoverPart = Part;
}

void AInspectionMachine::ClearHighlights()
{
	HighlightUntil.Reset();
	HighlightColor.Reset();
	HoverPart.Reset();
	for (const FMeshInfo& M : Meshes)
		if (M.Mat.IsValid()) M.Mat->SetVectorParameterValue(TEXT("Color"), M.Base);
}

void AInspectionMachine::SetEmergency(bool bOn)
{
	bEmergency = bOn;
}

void AInspectionMachine::SetDoorOpen(bool bOpen)
{
	bDoorOpen = bOpen;
}

FVector AInspectionMachine::GetFrontLocation(float DistanceCm) const
{
	const FVector S = GetSizeCm();
	return GetActorTransform().TransformPosition(FVector(0, -S.Y / 2 - DistanceCm, 0));
}

FVector AInspectionMachine::GetViewLocation() const
{
	const FVector S = GetSizeCm();
	const float Dist = FMath::Clamp(FMath::Max(S.X, S.Z) * 0.9f, 140.f, 420.f);
	return GetActorTransform().TransformPosition(FVector(-S.X * 0.25f, -S.Y / 2 - Dist, Station.ConveyorHeightMM / 10.f + 70.f));
}

FVector AInspectionMachine::GetFocusLocation() const
{
	const FVector S = GetSizeCm();
	return GetActorTransform().TransformPosition(FVector(0, 0, FMath::Min(S.Z * 0.55f, Station.ConveyorHeightMM / 10.f + 40.f)));
}

void AInspectionMachine::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Time += DeltaSeconds;
	const bool bMoving = bRunning && !bEmergency && !bDoorOpen;

	if (USceneComponent* H = Head.Get())
	{
		if (bMoving)
		{
			FVector L = H->GetRelativeLocation();
			L.X = FMath::Sin(Time * 0.6f) * HeadTravel;
			if (Station.Template != TEXT("axi")) L.Y = FMath::Cos(Time * 0.9f) * 12.f;
			H->SetRelativeLocation(L);
		}
	}
	if (USceneComponent* B = Blades.Get()) B->AddLocalRotation(FRotator(DeltaSeconds * 720.f, 0, 0));
	if (USceneComponent* P = Board.Get())
	{
		if (bMoving)
		{
			const float W = GetSizeCm().X + 10.f;
			FVector L = P->GetRelativeLocation();
			L.X = FMath::Fmod(Time * 12.f, W) - W / 2;
			P->SetRelativeLocation(L);
		}
	}
	if (USceneComponent* D = Door.Get())
	{
		const float Target = bDoorOpen ? 75.f : 0.f;
		DoorAngle = FMath::FInterpTo(DoorAngle, Target, DeltaSeconds, 4.f);
		D->SetRelativeRotation(FRotator(0, 0, -DoorAngle));
	}
	// Torre de luces: verde en operación, ámbar con puerta abierta, rojo en paro de emergencia
	if (Lamps.Num() == 3)
	{
		const float Blink = 0.5f + 0.5f * FMath::Sin(Time * 6.f);
		const FLinearColor On[3] = { FLinearColor(1.f, 0.1f, 0.1f), FLinearColor(1.f, 0.7f, 0.05f), FLinearColor(0.1f, 1.f, 0.3f) };
		const FLinearColor Off[3] = { FLinearColor(0.25f, 0.03f, 0.03f), FLinearColor(0.25f, 0.17f, 0.02f), FLinearColor(0.03f, 0.2f, 0.07f) };
		const int32 Active = bEmergency ? 0 : (bDoorOpen ? 1 : 2);
		for (int32 i = 0; i < 3; ++i)
			if (UMaterialInstanceDynamic* M = Lamps[i].Get())
				M->SetVectorParameterValue(TEXT("Color"), i == Active ? (Active == 0 ? FMath::Lerp(Off[0], On[0], Blink) : On[i]) : Off[i]);
	}
	// Resaltado de piezas (mantenimiento)
	TSet<FString> Lit;
	for (auto It = HighlightUntil.CreateIterator(); It; ++It)
	{
		if (It->Value < Time) { It.RemoveCurrent(); continue; }
		Lit.Add(It->Key);
	}
	const bool bEffects = Lit.Num() > 0 || !HoverPart.IsEmpty();
	if (!bEffects && !bHadEffects) return;
	bHadEffects = bEffects;
	for (const FMeshInfo& M : Meshes)
	{
		if (!M.Mat.IsValid() || M.Part.IsEmpty() || M.Part == TEXT("tower_light")) continue;
		FLinearColor C = M.Base;
		if (const FLinearColor* HC = Lit.Contains(M.Part) ? HighlightColor.Find(M.Part) : nullptr)
			C = FMath::Lerp(M.Base, *HC, 0.55f + 0.35f * FMath::Sin(Time * 10.f));
		else if (M.Part == HoverPart)
			C = FMath::Lerp(M.Base, FLinearColor(0.24f, 0.55f, 1.f), 0.45f);
		M.Mat->SetVectorParameterValue(TEXT("Color"), C);
	}
}
