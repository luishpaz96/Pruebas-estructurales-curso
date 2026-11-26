#include "SPracticeView.h"

#include "AcademiaGameInstance.h"
#include "AcademiaStyle.h"
#include "Misc/DateTime.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Input/SSlider.h"
#include "Widgets/Text/STextBlock.h"

using namespace AcademiaUI;

namespace
{
	void ShuffleInts(TArray<int32>& A)
	{
		for (int32 i = A.Num() - 1; i > 0; --i)
		{
			A.Swap(i, FMath::RandRange(0, i));
		}
	}
}

UAcademiaGameInstance* SPracticeView::GI() const
{
	TSharedPtr<SAcademiaShell> S = Shell.Pin();
	return S.IsValid() ? S->GI() : nullptr;
}

void SPracticeView::Construct(const FArguments& InArgs)
{
	Shell = InArgs._Shell;
	P = InArgs._Practice;

	if (!P)
	{
		ChildSlot[ SNew(STextBlock).Text(FText::FromString(TEXT("Práctica no disponible."))).Font(Font(16)).ColorAndOpacity(Text) ];
		return;
	}

	for (const FPracticeParam& Pa : P->Params) Values.Add(Pa.Start);

	FString MachineName;
	FLinearColor MachineColor = Accent;
	if (UAcademiaGameInstance* G = GI())
	{
		if (const FCourseMachine* M = G->Content().FindMachine(P->Machine))
		{
			MachineName = M->Name;
			MachineColor = M->Color;
		}
	}
	const bool bDebug = (P->Kind == TEXT("debug"));
	TWeakPtr<SAcademiaShell> WShell = Shell;

	// Panel izquierdo: bitácora
	LogBox = SNew(SVerticalBox);
	LogScroll = SNew(SScrollBox);
	LogScroll->AddSlot()[ LogBox.ToSharedRef() ];

	// Panel derecho: pasos
	PanelBox = SNew(SBox);

	ChildSlot
	[
		SNew(SScrollBox)
		+ SScrollBox::Slot()
		.HAlign(HAlign_Center)
		.Padding(20, 16)
		[
			SNew(SBox).MaxDesiredWidth(1200.f)
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 6)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)[ Tag(MachineName.IsEmpty() ? P->Machine : MachineName, MachineColor) ]
					+ SHorizontalBox::Slot().AutoWidth()[ Tag(bDebug ? TEXT("Debug") : TEXT("Creación"), bDebug ? Bad : Accent) ]
				]
				+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 6)[ AcademiaUI::Title(P->Title) ]
				+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 12)[ Body(P->Scenario) ]
				+ SVerticalBox::Slot().AutoHeight()
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(0.42f).Padding(0, 0, 10, 0)
					[
						SNew(SBox).HeightOverride(420.f)
						[
							SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FLinearColor(0.02f, 0.03f, 0.04f, 1.f)).Padding(10)
							[
								LogScroll.ToSharedRef()
							]
						]
					]
					+ SHorizontalBox::Slot().FillWidth(0.58f)
					[
						Card(PanelBox.ToSharedRef())
					]
				]
				+ SVerticalBox::Slot().AutoHeight().Padding(0, 14, 0, 30)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth()
					[ Button(TEXT("← Volver"), [WShell]() { if (TSharedPtr<SAcademiaShell> S = WShell.Pin()) S->Back(); }) ]
				]
			]
		]
	];

	if (bDebug) Log(TEXT("Alarma: ") + P->Scenario, Bad);
	else Log(TEXT("Programa nuevo abierto."), Muted);

	StepIdx = 0;
	Stage = P->Steps.Num() > 0 ? EStage::Steps : (P->Params.Num() > 0 ? EStage::Params : EStage::Done);
	if (Stage == EStage::Done) Finish();
	else
	{
		if (Stage == EStage::Steps) NextStep();
		RebuildPanel();
	}
}

void SPracticeView::Log(const FString& Line, const FLinearColor& Color)
{
	if (!LogBox.IsValid()) return;
	const FString Stamp = FDateTime::Now().ToString(TEXT("%H:%M:%S"));
	LogBox->AddSlot().AutoHeight().Padding(0, 1)
	[
		SNew(STextBlock)
		.Text(FText::FromString(FString::Printf(TEXT("[%s] %s"), *Stamp, *Line)))
		.Font(Mono(12))
		.ColorAndOpacity(Color)
		.AutoWrapText(true)
	];
	if (LogScroll.IsValid()) LogScroll->ScrollToEnd();
}

void SPracticeView::RebuildPanel()
{
	if (!PanelBox.IsValid()) return;
	switch (Stage)
	{
	case EStage::Steps:  PanelBox->SetContent(BuildStep()); break;
	case EStage::Params: PanelBox->SetContent(BuildParams()); break;
	case EStage::Done:   PanelBox->SetContent(BuildDone()); break;
	}
}

// Prepara el paso actual (mezcla las opciones, limpia estado)
void SPracticeView::NextStep()
{
	bStepDone = false;
	Disabled.Reset();
	Order.Reset();
	if (P->Steps.IsValidIndex(StepIdx))
	{
		for (int32 i = 0; i < P->Steps[StepIdx].Options.Num(); ++i) Order.Add(i);
		ShuffleInts(Order);
	}
}

TSharedRef<SWidget> SPracticeView::BuildStep()
{
	const FPracticeStep& S = P->Steps[StepIdx];
	TSharedRef<SVerticalBox> Col = SNew(SVerticalBox);
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 6)
	[ SNew(STextBlock).Text(FText::FromString(FString::Printf(TEXT("Paso %d de %d"), StepIdx + 1, P->Steps.Num()))).Font(Font(13)).ColorAndOpacity(Muted) ];
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 10)[ Body(S.Prompt, 17, Text) ];

	for (int32 Pos = 0; Pos < Order.Num(); ++Pos)
	{
		const int32 Orig = Order[Pos];
		Col->AddSlot().AutoHeight().Padding(0, 3)
		[
			OptionButton(S.Options[Orig],
				[this, Orig]() { PickOption(Orig); },
				TAttribute<FSlateColor>::CreateLambda([this, Orig]() -> FSlateColor
				{
					if (!P->Steps.IsValidIndex(StepIdx)) return FSlateColor(Line);
					if (Disabled.Contains(Orig)) return FSlateColor(Bad);
					if (bStepDone && Orig == P->Steps[StepIdx].Correct) return FSlateColor(Good);
					return FSlateColor(Line);
				}),
				TAttribute<bool>::CreateLambda([this, Orig]() { return !bStepDone && !Disabled.Contains(Orig); }))
		];
	}
	FeedbackBox = SNew(SVerticalBox);
	Col->AddSlot().AutoHeight().Padding(0, 10, 0, 0)[ FeedbackBox.ToSharedRef() ];
	return Col;
}

void SPracticeView::PickOption(int32 Orig)
{
	if (bStepDone || !P->Steps.IsValidIndex(StepIdx)) return;
	const FPracticeStep& S = P->Steps[StepIdx];
	const bool bOk = (Orig == S.Correct);
	UAcademiaGameInstance* G = GI();
	if (G)
	{
		G->RegisterAnswer(bOk, FString::Printf(TEXT("%s-s%d"), *P->Id, StepIdx));
		G->Sfx(bOk ? EAcademiaSfx::Ok : EAcademiaSfx::Bad);
	}
	FeedbackBox->ClearChildren();
	if (bOk)
	{
		++Score;
		bStepDone = true;
		Log(TEXT("OK: ") + S.Options[Orig], Good);
		FeedbackBox->AddSlot().AutoHeight().Padding(0, 0, 0, 8)[ Callout(S.Feedback.IsEmpty() ? FString(TEXT("Correcto.")) : S.Feedback, Good) ];
		FeedbackBox->AddSlot().AutoHeight()
		[
			Button(TEXT("Continuar"), [this]()
			{
				++StepIdx;
				if (StepIdx < P->Steps.Num()) { NextStep(); RebuildPanel(); }
				else if (P->Params.Num() > 0) { Stage = EStage::Params; RebuildPanel(); }
				else Finish();
			}, Accent, true)
		];
	}
	else
	{
		++Mistakes;
		Disabled.Add(Orig);
		Log(TEXT("ERROR: ") + S.Options[Orig], Bad);
		FeedbackBox->AddSlot().AutoHeight()[ Callout(TEXT("No es lo mejor. ") + S.Feedback, Bad) ];
	}
}

// Misma fórmula que evalParams de simui.js
void SPracticeView::EvalParams(int32& OutF, int32& OutE) const
{
	int32 F = 0, E = 0;
	for (int32 i = 0; i < P->Params.Num(); ++i)
	{
		const FPracticeParam& Pa = P->Params[i];
		const float V = Values.IsValidIndex(i) ? Values[i] : Pa.Start;
		float Span = Pa.Max - Pa.Min;
		if (FMath::IsNearlyZero(Span)) Span = 1.f;
		const bool bLowE = Pa.bLowIsEscape;
		if (V < Pa.TargetMin)
		{
			const int32 N = FMath::RoundToInt(FMath::Min(1.f, (Pa.TargetMin - V) / Span * 3.f) * 18.f + 1.f);
			if (bLowE) E += FMath::CeilToInt(N / 3.f); else F += N;
		}
		if (V > Pa.TargetMax)
		{
			const int32 N = FMath::RoundToInt(FMath::Min(1.f, (V - Pa.TargetMax) / Span * 3.f) * 18.f + 1.f);
			if (bLowE) F += N; else E += FMath::CeilToInt(N / 3.f);
		}
	}
	OutF = F;
	OutE = E;
}

TSharedRef<SWidget> SPracticeView::BuildParams()
{
	TSharedRef<SVerticalBox> Col = SNew(SVerticalBox);
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 8)
	[ SNew(STextBlock).Text(FText::FromString(TEXT("Ajuste de parámetros"))).Font(Font(18, true)).ColorAndOpacity(Text) ];

	for (int32 i = 0; i < P->Params.Num(); ++i)
	{
		const FPracticeParam& Pa = P->Params[i];
		Col->AddSlot().AutoHeight().Padding(0, 6)
		[
			SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight()
			[
				SNew(STextBlock)
				.Text_Lambda([this, i]()
				{
					const FPracticeParam& Q = P->Params[i];
					return FText::FromString(FString::Printf(TEXT("%s: %.2f %s"), *Q.Name, Values[i], *Q.Unit));
				})
				.Font(Font(15, true))
				.ColorAndOpacity(Text)
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
			[
				SNew(SSlider)
				.MinValue(Pa.Min)
				.MaxValue(Pa.Max)
				.StepSize(FMath::Max(KINDA_SMALL_NUMBER, (Pa.Max - Pa.Min) / 100.f))
				.Value_Lambda([this, i]() { return Values[i]; })
				.OnValueChanged_Lambda([this, i](float V) { Values[i] = V; })
			]
			+ SVerticalBox::Slot().AutoHeight()[ Body(Pa.Hint, 13, Muted) ]
		];
	}

	Col->AddSlot().AutoHeight().Padding(0, 10)
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 20, 0)
		[
			SNew(STextBlock)
			.Text_Lambda([this]() { int32 F, E; EvalParams(F, E); return FText::FromString(FString::Printf(TEXT("Falsos llamados: %d"), F)); })
			.Font(Font(15, true)).ColorAndOpacity(Warn)
		]
		+ SHorizontalBox::Slot().AutoWidth()
		[
			SNew(STextBlock)
			.Text_Lambda([this]() { int32 F, E; EvalParams(F, E); return FText::FromString(FString::Printf(TEXT("Escapes: %d"), E)); })
			.Font(Font(15, true)).ColorAndOpacity(Bad)
		]
	];
	Col->AddSlot().AutoHeight().Padding(0, 6)[ Button(TEXT("Aplicar y correr 50 tarjetas"), [this]() { ApplyParams(); }, Accent, true) ];
	return Col;
}

void SPracticeView::ApplyParams()
{
	int32 F = 0, E = 0;
	EvalParams(F, E);
	UAcademiaGameInstance* G = GI();
	Log(FString::Printf(TEXT("Lote de 50: %d falsos llamados, %d escapes"), F, E), (F + E) ? Warn : Good);
	if (F + E == 0)
	{
		if (G) G->Sfx(EAcademiaSfx::Ok);
		Finish();
	}
	else
	{
		++Mistakes;
		if (G)
		{
			G->Sfx(EAcademiaSfx::Bad);
			G->Toast(TEXT("Ajusta hasta tener 0 falsos llamados y 0 escapes"));
		}
	}
}

void SPracticeView::Finish()
{
	Pct = FMath::Max(0, FMath::RoundToInt(100.f * float(Score) / float(FMath::Max(1, Score + Mistakes))));
	Stage = EStage::Done;
	if (UAcademiaGameInstance* G = GI()) G->RecordPractice(P->Id, Pct);
	Log(TEXT("Programa validado y guardado."), Good);
	RebuildPanel();
}

TSharedRef<SWidget> SPracticeView::BuildDone()
{
	TWeakPtr<SAcademiaShell> WShell = Shell;
	const FLinearColor C = Pct >= 70 ? Good : Bad;
	return SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 6)
		[ SNew(STextBlock).Text(FText::FromString(TEXT("Práctica terminada"))).Font(Font(18, true)).ColorAndOpacity(Text) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 6)
		[ SNew(STextBlock).Text(FText::FromString(FString::Printf(TEXT("%d%%"), Pct))).Font(Font(48, true)).ColorAndOpacity(C) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 10)
		[ Body(FString::Printf(TEXT("Errores: %d"), Mistakes)) ]
		+ SVerticalBox::Slot().AutoHeight()
		[ Button(TEXT("Volver"), [WShell]() { if (TSharedPtr<SAcademiaShell> S = WShell.Pin()) S->Back(); }, Accent, true) ];
}
