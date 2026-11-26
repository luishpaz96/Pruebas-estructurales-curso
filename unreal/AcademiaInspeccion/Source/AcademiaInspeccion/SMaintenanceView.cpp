#include "SMaintenanceView.h"

#include "SAcademiaShell.h"
#include "AcademiaGameInstance.h"
#include "AcademiaStyle.h"
#include "InspectionMachine.h"

#include "Math/RandomStream.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SUniformGridPanel.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SCheckBox.h"

namespace
{
	// Mismo token para que un panel viejo no borre los hooks de uno nuevo
	int32 GMaintToken = 0;

	FLinearColor ActionColor(const FString& Action)
	{
		auto C = [](uint8 R, uint8 G, uint8 B) { return FLinearColor::FromSRGBColor(FColor(R, G, B)); };
		if (Action == TEXT("clean")) return C(0x4f, 0xd1, 0xff);
		if (Action == TEXT("lubricate")) return C(0xff, 0xd4, 0x3b);
		if (Action == TEXT("replace")) return C(0x36, 0xd0, 0x7f);
		if (Action == TEXT("calibrate")) return C(0xa7, 0x7b, 0xff);
		if (Action == TEXT("measure")) return FLinearColor::White;
		if (Action == TEXT("inspect")) return C(0x3d, 0x8b, 0xff);
		if (Action == TEXT("toggle")) return C(0xff, 0x5a, 0x5f);
		return C(0x36, 0xd0, 0x7f);
	}

	bool IsSafeFirst(const FString& Part) { return Part == TEXT("emergency_stop") || Part == TEXT("interlock"); }
	FText Tx(const FString& S) { return FText::FromString(S); }
}

UAcademiaGameInstance* SMaintenanceView::GI() const
{
	const TSharedPtr<SAcademiaShell> S = Shell.Pin();
	return S.IsValid() ? S->GI() : nullptr;
}

void SMaintenanceView::Construct(const FArguments& InArgs)
{
	Shell = InArgs._Shell;
	Proc = InArgs._Proc;
	Machine = InArgs._Machine;

	// Clic y paso del cursor sobre piezas 3D llegan a través del shell
	HookToken = ++GMaintToken;
	if (const TSharedPtr<SAcademiaShell> S = Shell.Pin())
	{
		S->OnPartPicked = [this](const FString& Part)
		{
			if (Phase == EPhase::Steps) { SelectPart(Part); }
		};
		S->OnPartHovered = [this](const FString& Part)
		{
			if (AInspectionMachine* M = Machine.Get()) { M->SetHover(Part); }
		};
	}

	ResetState();

	SAssignNew(BodyBox, SBox);
	ChildSlot
	[
		SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 8)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 10, 0)
			[
				AcademiaUI::Button(TEXT("← Volver"), [this]()
				{
					if (const TSharedPtr<SAcademiaShell> S = Shell.Pin()) { S->Back(); }
				}, AcademiaUI::Muted, false, 14)
			]
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 6, 0)
			[
				AcademiaUI::Tag(Proc ? Proc->Frequency : FString(), AcademiaUI::Accent)
			]
		]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 8)
		[
			AcademiaUI::Title(Proc ? Proc->Title : FString(TEXT("Mantenimiento")), 22)
		]
		+ SVerticalBox::Slot().FillHeight(1.f)
		[
			SNew(SScrollBox)
			+ SScrollBox::Slot()[ BodyBox.ToSharedRef() ]
		]
	];
	Refresh();
}

SMaintenanceView::~SMaintenanceView()
{
	if (const TSharedPtr<SAcademiaShell> S = Shell.Pin())
	{
		if (GMaintToken == HookToken)
		{
			S->OnPartPicked = nullptr;
			S->OnPartHovered = nullptr;
		}
	}
	if (AInspectionMachine* M = Machine.Get())
	{
		M->ClearHighlights();
		M->SetEmergency(false);
		M->SetDoorOpen(false);
	}
}

void SMaintenanceView::ResetState()
{
	Phase = EPhase::Safety;
	Step = 0; Errors = 0.f; bSafetyFault = false; bEstopDone = false; bFallbackOpen = false; Pct = 0;
	Chosen.Empty();
	const int32 NItems = (Proc && Proc->Safety.Num() > 0) ? Proc->Safety.Num() : 2;
	Checked.Init(false, NItems);
}

void SMaintenanceView::ShuffleActions()
{
	// Mezcla con semilla Step+3, como shuffle(Object.keys(ACTION_NAMES), i + 3) del JS
	ActionOrder = FCourseContent::AllActions();
	FRandomStream Rng(Step + 3);
	for (int32 i = ActionOrder.Num() - 1; i > 0; --i)
	{
		ActionOrder.Swap(i, Rng.RandRange(0, i));
	}
}

void SMaintenanceView::Refresh()
{
	if (!BodyBox.IsValid()) { return; }
	switch (Phase)
	{
	case EPhase::Safety: BodyBox->SetContent(BuildSafety()); break;
	case EPhase::Steps: BodyBox->SetContent(BuildStep()); break;
	default: BodyBox->SetContent(BuildResult()); break;
	}
}

// ------------------------------------------------------------------------------------------------
// Seguridad
// ------------------------------------------------------------------------------------------------
TSharedRef<SWidget> SMaintenanceView::BuildSafety()
{
	TArray<FString> Items;
	if (Proc && Proc->Safety.Num() > 0) { Items = Proc->Safety; }
	else
	{
		Items.Add(TEXT("Avisa al supervisor y a producción antes de detener la máquina."));
		Items.Add(TEXT("Usa el equipo de protección indicado (pulsera antiestática, lentes)."));
	}
	TSharedRef<SVerticalBox> List = SNew(SVerticalBox);
	for (int32 i = 0; i < Items.Num(); ++i)
	{
		List->AddSlot().AutoHeight().Padding(0, 3)
		[
			SNew(SCheckBox)
			.IsChecked_Lambda([this, i]() { return Checked.IsValidIndex(i) && Checked[i] ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
			.OnCheckStateChanged_Lambda([this, i](ECheckBoxState S) { if (Checked.IsValidIndex(i)) { Checked[i] = (S == ECheckBoxState::Checked); } })
			[
				AcademiaUI::Body(Items[i], 14)
			]
		];
	}
	auto AllChecked = [this]()
	{
		for (const bool b : Checked) { if (!b) { return false; } }
		return true;
	};
	return AcademiaUI::Card(
		SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight() [ AcademiaUI::Title(TEXT("Antes de empezar: seguridad"), 18) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4, 0, 8) [ AcademiaUI::Body(TEXT("Confirma cada punto. Es parte de la calificación."), 13, AcademiaUI::Muted) ]
		+ SVerticalBox::Slot().AutoHeight() [ List ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 12, 0, 0)
		[
			SNew(SBox).IsEnabled_Lambda(AllChecked)
			[
				AcademiaUI::Button(TEXT("Comenzar procedimiento"), [this]()
				{
					Phase = EPhase::Steps; Step = 0; Chosen.Empty();
					ShuffleActions();
					if (UAcademiaGameInstance* G = GI()) { G->Sfx(EAcademiaSfx::Ok); }
					Refresh();
				}, AcademiaUI::Accent, true, 15)
			]
		]);
}

// ------------------------------------------------------------------------------------------------
// Pasos
// ------------------------------------------------------------------------------------------------
TArray<FString> SMaintenanceView::ListableParts() const
{
	TArray<FString> Out;
	if (const AInspectionMachine* M = Machine.Get())
	{
		for (const FString& P : M->GetPartIds()) { if (FCourseContent::PartName(P) != P) { Out.AddUnique(P); } }
	}
	if (Out.Num() == 0 && Proc)
	{
		for (const FMaintStep& S : Proc->Steps) { Out.AddUnique(S.Part); }
	}
	return Out;
}

FString SMaintenanceView::ErrorsText() const
{
	const bool bWhole = FMath::IsNearlyEqual(Errors, FMath::RoundToFloat(Errors));
	const FString E = bWhole ? FString::FromInt((int32)Errors) : FString::Printf(TEXT("%.1f"), Errors);
	return FString::Printf(TEXT("Errores: %s%s"), *E, bSafetyFault ? TEXT("  ·  falta de seguridad registrada") : TEXT(""));
}

TSharedRef<SWidget> SMaintenanceView::BuildStep()
{
	if (!Proc || !Proc->Steps.IsValidIndex(Step)) { return SNullWidget::NullWidget; }
	const FMaintStep& S = Proc->Steps[Step];
	const int32 N = Proc->Steps.Num();

	// Piezas (respaldo para quien no encuentre la pieza en 3D)
	TSharedRef<SWidget> Fallback = SNullWidget::NullWidget;
	if (bFallbackOpen)
	{
		TSharedRef<SUniformGridPanel> Grid = SNew(SUniformGridPanel).SlotPadding(FMargin(2.f));
		int32 Idx = 0;
		for (const FString& P : ListableParts())
		{
			Grid->AddSlot(Idx % 2, Idx / 2)
			[
				AcademiaUI::Button(FCourseContent::PartName(P), [this, P]()
				{
					Errors += 0.5f; // elegir de la lista cuesta medio error
					SelectPart(P);
				}, AcademiaUI::Accent, false, 12)
			];
			++Idx;
		}
		Fallback = Grid;
	}

	// Acciones en orden mezclado
	TSharedRef<SUniformGridPanel> Actions = SNew(SUniformGridPanel).SlotPadding(FMargin(2.f));
	for (int32 i = 0; i < ActionOrder.Num(); ++i)
	{
		const FString A = ActionOrder[i];
		Actions->AddSlot(i % 2, i / 2)
		[
			AcademiaUI::Button(FCourseContent::ActionName(A), [this, A]() { DoAction(A); }, ActionColor(A), false, 14)
		];
	}

	// Lista de pasos
	TSharedRef<SVerticalBox> StepList = SNew(SVerticalBox);
	for (int32 k = 0; k < N; ++k)
	{
		FString Label;
		FLinearColor Col = AcademiaUI::Muted;
		if (k <= Step)
		{
			const FString& T = Proc->Steps[k].Text;
			Label = T.Len() > 70 ? T.Left(70) + TEXT("…") : T;
		}
		else { Label = FString::Printf(TEXT("Paso %d"), k + 1); }
		const TCHAR* Mark = k < Step ? TEXT("✔ ") : (k == Step ? TEXT("▶ ") : TEXT("○ "));
		if (k < Step) { Col = AcademiaUI::Good; } else if (k == Step) { Col = AcademiaUI::Accent; }
		StepList->AddSlot().AutoHeight().Padding(0, 1)[ AcademiaUI::Body(FString(Mark) + Label, 12, Col) ];
	}

	const FString Sel = Chosen.IsEmpty() ? FString(TEXT("Sin seleccionar")) : FCourseContent::PartName(Chosen);

	return AcademiaUI::Card(
		SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight() [ AcademiaUI::Title(FString::Printf(TEXT("Paso %d de %d"), Step + 1, N), 18) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4, 0, 8) [ AcademiaUI::Body(S.Text, 14) ]
		+ SVerticalBox::Slot().AutoHeight() [ AcademiaUI::Body(TEXT("1. Haz clic en la pieza del modelo 3D."), 14) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 2, 0, 4) [ AcademiaUI::Tag(Sel, Chosen.IsEmpty() ? AcademiaUI::Muted : AcademiaUI::Warn) ]
		+ SVerticalBox::Slot().AutoHeight()
		[
			AcademiaUI::Button(bFallbackOpen ? TEXT("▾ No la encuentro: elegir de la lista (cuesta 0.5 error)") : TEXT("▸ No la encuentro: elegir de la lista"),
				[this]() { bFallbackOpen = !bFallbackOpen; Refresh(); }, AcademiaUI::Muted, false, 12)
		]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4) [ Fallback ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 4) [ AcademiaUI::Body(TEXT("2. Elige la acción:"), 14) ]
		+ SVerticalBox::Slot().AutoHeight()
		[
			SNew(SBox).IsEnabled_Lambda([this]() { return !Chosen.IsEmpty(); })
			[ Actions ]
		]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 14, 0, 4) [ StepList ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4, 0, 0) [ AcademiaUI::Body(ErrorsText(), 12, bSafetyFault ? AcademiaUI::Bad : AcademiaUI::Muted) ]);
}

void SMaintenanceView::SelectPart(const FString& Part)
{
	if (Phase != EPhase::Steps) { return; }
	AInspectionMachine* M = Machine.Get();
	if (M && !M->HasPart(Part)) { return; }
	Chosen = Part;
	if (M)
	{
		M->ClearHighlights();
		M->HighlightPart(Part, AcademiaUI::Warn, 600.f);
	}
	if (UAcademiaGameInstance* G = GI()) { G->Sfx(EAcademiaSfx::Click); }
	Refresh();
}

void SMaintenanceView::DoAction(const FString& Action)
{
	if (Phase != EPhase::Steps || !Proc || !Proc->Steps.IsValidIndex(Step)) { return; }
	const FMaintStep& S = Proc->Steps[Step];
	UAcademiaGameInstance* G = GI();
	const TSharedPtr<SAcademiaShell> Sh = Shell.Pin();
	AInspectionMachine* M = Machine.Get();

	// Regla de seguridad: tocar piezas internas antes de accionar el paro/interlock cuando el procedimiento lo pide
	int32 FirstSafe = INDEX_NONE;
	for (int32 k = 0; k < Proc->Steps.Num(); ++k) { if (IsSafeFirst(Proc->Steps[k].Part)) { FirstSafe = k; break; } }
	const bool bNeedsSafe = FirstSafe != INDEX_NONE && !bEstopDone && !IsSafeFirst(S.Part) && FirstSafe < Step;

	if (Chosen == S.Part && Action == S.Action)
	{
		if (IsSafeFirst(S.Part)) { bEstopDone = true; }
		if (M)
		{
			M->ClearHighlights();
			if (S.Part == TEXT("emergency_stop")) { M->SetEmergency(true); }
			else if (S.Part == TEXT("door")) { M->SetDoorOpen(!M->IsDoorOpen()); }
			M->HighlightPart(S.Part, ActionColor(Action), 1.2f);
		}
		if (G) { G->Sfx(EAcademiaSfx::Ok); }
		if (Sh.IsValid()) { Sh->Toast(FString::Printf(TEXT("✓ %s: %s"), *FCourseContent::ActionName(Action), *FCourseContent::PartName(S.Part))); }
		Chosen.Empty();
		++Step;
		if (Step >= Proc->Steps.Num()) { Finish(); }
		else { ShuffleActions(); Refresh(); }
	}
	else
	{
		Errors += 1.f;
		if (G) { G->Sfx(EAcademiaSfx::Bad); }
		if (bNeedsSafe) { bSafetyFault = true; }
		const FString Why = (Chosen != S.Part)
			? FString::Printf(TEXT("Esa no es la pieza. Busca: %s."), *FCourseContent::PartName(S.Part))
			: FString(TEXT("La pieza es correcta, pero la acción no. Lee de nuevo el paso."));
		if (Sh.IsValid()) { Sh->Toast(Why); }
		Refresh();
	}
}

// ------------------------------------------------------------------------------------------------
// Resultado
// ------------------------------------------------------------------------------------------------
void SMaintenanceView::Finish()
{
	Phase = EPhase::Result;
	Pct = FMath::Max(0, FMath::RoundToInt(100.f - Errors * 8.f - (bSafetyFault ? 20.f : 0.f)));
	if (AInspectionMachine* M = Machine.Get()) { M->ClearHighlights(); }
	if (UAcademiaGameInstance* G = GI()) { if (Proc) { G->RecordMaintenance(Proc->Id, Pct, !bSafetyFault); } }
	if (Pct >= 70) { if (const TSharedPtr<SAcademiaShell> S = Shell.Pin()) { S->Celebrate(); } }
	Refresh();
}

TSharedRef<SWidget> SMaintenanceView::BuildResult()
{
	const FLinearColor Col = Pct >= 70 ? AcademiaUI::Good : AcademiaUI::Bad;
	FString Msg = ErrorsText();
	Msg += (Pct == 100) ? TEXT(". Impecable.") : TEXT(". Repite para subir tu marca.");
	return AcademiaUI::Card(
		SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight() [ AcademiaUI::Title(TEXT("Procedimiento terminado"), 18) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 8) [ AcademiaUI::Title(FString::FromInt(Pct), 48) ]
		+ SVerticalBox::Slot().AutoHeight() [ AcademiaUI::Progress(Pct / 100.f, Col, 10.f) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 8) [ AcademiaUI::Body(Msg, 14) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 6, 0, 0)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0) [ AcademiaUI::Button(TEXT("Repetir"), [this]() { Restart(); }, AcademiaUI::Accent, true, 15) ]
			+ SHorizontalBox::Slot().AutoWidth() [ AcademiaUI::Button(TEXT("Volver"), [this]()
			{
				if (const TSharedPtr<SAcademiaShell> S = Shell.Pin()) { S->Back(); }
			}, AcademiaUI::Muted, false, 15) ]
		]);
}

void SMaintenanceView::Restart()
{
	if (AInspectionMachine* M = Machine.Get())
	{
		M->ClearHighlights();
		M->SetEmergency(false);
		M->SetDoorOpen(false);
	}
	ResetState();
	Refresh();
}
