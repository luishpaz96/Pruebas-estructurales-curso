#include "SAcademiaShell.h"

#include "AcademiaGameInstance.h"
#include "AcademiaSaveGame.h"
#include "AcademiaPlayerController.h"
#include "AcademiaStyle.h"
#include "InspectionMachine.h"
#include "MentorActor.h"
#include "SLessonView.h"
#include "SExamView.h"
#include "SPracticeView.h"
#include "SMaintenanceView.h"
#include "SMachineSoftware.h"

#include "Framework/Application/SlateApplication.h"
#include "Widgets/SOverlay.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SWrapBox.h"
#include "Widgets/Layout/SSpacer.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SSlider.h"
#include "Widgets/Images/SImage.h"
#include "Widgets/SLeafWidget.h"
#include "Rendering/DrawElements.h"
#include "HAL/PlatformApplicationMisc.h"
#include "Misc/App.h"
#include "Kismet/KismetSystemLibrary.h"

using namespace AcademiaUI;

// ------------------------------------------------------------------ Confeti (celebración)

class SConfetti : public SLeafWidget
{
public:
	SLATE_BEGIN_ARGS(SConfetti) {}
	SLATE_END_ARGS()
	void Construct(const FArguments&) {}
	void Fire(double Now)
	{
		Start = Now;
		Pieces.Reset();
		const FLinearColor Cols[] = { Accent, Good, Warn, Bad, FLinearColor(0.65f, 0.48f, 1.f) };
		for (int32 i = 0; i < 140; ++i)
			Pieces.Add({ FMath::FRand(), -FMath::FRand() * 0.3f, FMath::FRandRange(-0.08f, 0.08f), FMath::FRandRange(0.25f, 0.55f), FMath::FRandRange(6.f, 12.f), Cols[i % 5] });
	}
	virtual FVector2D ComputeDesiredSize(float) const override { return FVector2D(1, 1); }
	virtual int32 OnPaint(const FPaintArgs&, const FGeometry& G, const FSlateRect&, FSlateWindowElementList& Out, int32 Layer, const FWidgetStyle&, bool) const override
	{
		const double T = FSlateApplication::Get().GetCurrentTime() - Start;
		if (T > 2.6 || Pieces.Num() == 0) return Layer;
		const FVector2D Size = G.GetLocalSize();
		for (const FPiece& P : Pieces)
		{
			const float X = (P.X + P.VX * T) * Size.X;
			const float Y = (P.Y + P.VY * T + 0.25f * T * T) * Size.Y;
			if (Y < -20 || Y > Size.Y) continue;
			FLinearColor C = P.Color;
			C.A = FMath::Clamp(2.6f - (float)T, 0.f, 1.f);
			FSlateDrawElement::MakeBox(Out, Layer, G.ToPaintGeometry(FVector2D(P.S, P.S * 0.6f), FSlateLayoutTransform(FVector2D(X, Y))), White(), ESlateDrawEffect::None, C);
		}
		return Layer + 1;
	}
private:
	struct FPiece { float X, Y, VX, VY, S; FLinearColor Color; };
	TArray<FPiece> Pieces;
	double Start = -100.0;
};

// ------------------------------------------------------------------ Utilidades

namespace
{
	FString TaskLabel(const FCourseContent& C, const FMissionTask& T)
	{
		if (!T.Text.IsEmpty() && T.Kind != EMissionTask::Talk) return T.Text;
		switch (T.Kind)
		{
		case EMissionTask::Talk: return TEXT("Escucha a tu mentora");
		case EMissionTask::GoTo: { const FLineStation* S = C.FindStationForMachine(T.Machine); return TEXT("Ve a ") + (S ? S->Name : T.Machine); }
		case EMissionTask::Lesson: { const FCourseLesson* L = C.FindLesson(T.Ref); return TEXT("Lección: ") + (L ? L->Title : T.Ref); }
		case EMissionTask::Practice: { const FPractice* P = C.FindPractice(T.Ref); return TEXT("Práctica: ") + (P ? P->Title : T.Ref); }
		case EMissionTask::Maintenance: { const FMaintProc* P = C.FindMaintenance(T.Ref); return TEXT("Mantenimiento: ") + (P ? P->Title : T.Ref); }
		case EMissionTask::Exam: { const FCourseModule* M = C.FindModule(T.Ref); return TEXT("Examen: ") + (M ? M->Title : FString(TEXT("final"))); }
		case EMissionTask::Program: return TEXT("Crea y libera un programa ") + T.Mode.ToUpper();
		case EMissionTask::Quiz: return TEXT("Responde la pregunta de tu mentora");
		}
		return FString();
	}

	FString MissionTypeName(const FString& T)
	{
		static const TMap<FString, FString> N = {
			{ TEXT("induccion"), TEXT("Inducción") }, { TEXT("capacitacion"), TEXT("Capacitación") }, { TEXT("npi"), TEXT("NPI: programa nuevo") },
			{ TEXT("debug"), TEXT("Debug") }, { TEXT("falla"), TEXT("Falla de equipo") }, { TEXT("cambio_modelo"), TEXT("Cambio de modelo") },
			{ TEXT("fixture_ict"), TEXT("Cambio de fixture ICT") }, { TEXT("mantenimiento"), TEXT("Mantenimiento") }, { TEXT("certificacion"), TEXT("Certificación") },
		};
		const FString* F = N.Find(T);
		return F ? *F : T;
	}

	// Encabezado común de las pantallas del menú
	TSharedRef<SWidget> Header(const FString& Title, const FString& Sub, TFunction<void()> OnBack)
	{
		return SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 8)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth()[Button(TEXT("← Volver"), OnBack, Muted)]
				+ SHorizontalBox::Slot().FillWidth(1.f)[SNullWidget::NullWidget]
			]
			+ SVerticalBox::Slot().AutoHeight()[AcademiaUI::Title(Title, 28)]
			+ SVerticalBox::Slot().AutoHeight().Padding(0, 4, 0, 14)[Body(Sub, 15, Muted)];
	}

	// Contenedor centrado y con scroll para pantallas de menú
	TSharedRef<SWidget> Page(TSharedRef<SWidget> Content, float MaxWidth = 1100.f)
	{
		return SNew(SBorder).BorderImage(White()).BorderBackgroundColor(Bg).Padding(FMargin(24, 70, 24, 24))
			[
				SNew(SScrollBox)
				+ SScrollBox::Slot().HAlign(HAlign_Center)
				[
					SNew(SBox).MaxDesiredWidth(MaxWidth).WidthOverride(MaxWidth)
					[
						Content
					]
				]
			];
	}

	TSharedRef<SWidget> Tile(const FString& Title, const FString& Sub, FLinearColor Color, TFunction<void()> OnClick, float Width = 340.f)
	{
		return SNew(SBox).WidthOverride(Width).HeightOverride(118.f)
			[
				SNew(SButton)
				.ButtonStyle(&FCoreStyle::Get().GetWidgetStyle<FButtonStyle>("NoBorder"))
				.ContentPadding(0)
				.OnClicked_Lambda([OnClick]() { if (OnClick) OnClick(); return FReply::Handled(); })
				[
					SNew(SBorder).BorderImage(White()).BorderBackgroundColor(Line).Padding(1)
					[
						SNew(SBorder).BorderImage(White()).BorderBackgroundColor(Panel).Padding(14)
						[
							SNew(SVerticalBox)
							+ SVerticalBox::Slot().AutoHeight()
							[
								SNew(SBox).HeightOverride(4).WidthOverride(48)[SNew(SImage).Image(White()).ColorAndOpacity(Color)]
							]
							+ SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 4)
							[
								SNew(STextBlock).Text(FText::FromString(Title)).Font(Font(17, true)).ColorAndOpacity(AcademiaUI::Text)
							]
							+ SVerticalBox::Slot().FillHeight(1.f)
							[
								SNew(STextBlock).Text(FText::FromString(Sub)).Font(Font(13)).ColorAndOpacity(Muted).AutoWrapText(true)
							]
						]
					]
				]
			];
	}

	TSharedRef<SWidget> Row(const FString& Left, const FString& Right, FLinearColor RightColor, TFunction<void()> OnClick, bool bEnabled = true)
	{
		return SNew(SButton)
			.ButtonStyle(&FCoreStyle::Get().GetWidgetStyle<FButtonStyle>("NoBorder"))
			.ContentPadding(0)
			.IsEnabled(bEnabled)
			.OnClicked_Lambda([OnClick]() { if (OnClick) OnClick(); return FReply::Handled(); })
			[
				SNew(SBorder).BorderImage(White()).BorderBackgroundColor(Panel2).Padding(FMargin(14, 10))
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
					[
						SNew(STextBlock).Text(FText::FromString(Left)).Font(Font(15)).ColorAndOpacity(bEnabled ? AcademiaUI::Text : Muted).AutoWrapText(true)
					]
					+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(12, 0, 0, 0)
					[
						SNew(STextBlock).Text(FText::FromString(Right)).Font(Font(13, true)).ColorAndOpacity(RightColor)
					]
				]
			];
	}

	TSharedRef<SWidget> Section(const FString& Title)
	{
		return SNew(SBox).Padding(FMargin(0, 18, 0, 8))[SNew(STextBlock).Text(FText::FromString(Title)).Font(Font(18, true)).ColorAndOpacity(AcademiaUI::Text)];
	}
}

// ------------------------------------------------------------------ Construcción del shell

void SAcademiaShell::Construct(const FArguments& InArgs)
{
	Owner = InArgs._Owner;
	TSharedPtr<SConfetti> Confetti;

	ChildSlot
	[
		SNew(SOverlay)
		// Vista a pantalla completa
		+ SOverlay::Slot()[SAssignNew(FullSlot, SBox)]
		// Panel derecho (mantenimiento con la máquina 3D visible)
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Fill).Padding(FMargin(0, 60, 12, 12))
		[
			SAssignNew(RightSlot, SBox).WidthOverride(540.f).Visibility(EVisibility::Collapsed)
		]
		// Barra superior
		+ SOverlay::Slot().VAlign(VAlign_Top)[BuildTopBar()]
		// Indicador contextual
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Bottom).Padding(0, 0, 0, 28)
		[
			SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FLinearColor(0, 0, 0, 0.55f)).Padding(FMargin(14, 6))
			.Visibility_Lambda([this]() { return (!HintText.IsEmpty() && Stack.Num() == 0 && DialogLines.Num() == 0) ? EVisibility::HitTestInvisible : EVisibility::Collapsed; })
			[
				SNew(STextBlock).Text_Lambda([this]() { return FText::FromString(HintText); }).Font(Font(15, true)).ColorAndOpacity(AcademiaUI::Text)
			]
		]
		// Mira central para caminar
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Center)
		[
			SNew(SBox).WidthOverride(6).HeightOverride(6)
			.Visibility_Lambda([this]() { return (Stack.Num() == 0 && DialogLines.Num() == 0) ? EVisibility::HitTestInvisible : EVisibility::Collapsed; })
			[
				SNew(SImage).Image(White()).ColorAndOpacity(FLinearColor(1, 1, 1, 0.7f))
			]
		]
		// Diálogo del mentor
		+ SOverlay::Slot().HAlign(HAlign_Center).VAlign(VAlign_Bottom).Padding(0, 0, 0, 40)[BuildDialogBox()]
		// Avisos
		+ SOverlay::Slot().HAlign(HAlign_Right).VAlign(VAlign_Top).Padding(FMargin(0, 70, 16, 0))
		[
			SNew(SBox).WidthOverride(380)[SAssignNew(ToastBox, SVerticalBox).Visibility(EVisibility::HitTestInvisible)]
		]
		// Confeti
		+ SOverlay::Slot()[SAssignNew(Confetti, SConfetti).Visibility(EVisibility::HitTestInvisible)]
	];
	ConfettiWidget = Confetti;

	if (UAcademiaGameInstance* G = GI())
	{
		ToastHandle = G->OnToast.AddSP(this, &SAcademiaShell::Toast);
		MissionHandle = G->OnMissionChanged.AddSP(this, &SAcademiaShell::HandleMissionChanged);
		CelebrateHandle = G->OnCelebrate.AddSP(this, &SAcademiaShell::Celebrate);
	}
}

SAcademiaShell::~SAcademiaShell()
{
	if (UAcademiaGameInstance* G = GI())
	{
		G->OnToast.Remove(ToastHandle);
		G->OnMissionChanged.Remove(MissionHandle);
		G->OnCelebrate.Remove(CelebrateHandle);
	}
}

UAcademiaGameInstance* SAcademiaShell::GI() const
{
	return Owner.IsValid() ? UAcademiaGameInstance::Get(Owner.Get()) : nullptr;
}

TSharedRef<SWidget> SAcademiaShell::BuildTopBar()
{
	return SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FLinearColor(0.02f, 0.025f, 0.035f, 0.88f)).Padding(FMargin(16, 8))
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
			[
				SNew(STextBlock).Text(FText::FromString(TEXT("ACADEMIA DE INSPECCIÓN"))).Font(Font(14, true)).ColorAndOpacity(Accent)
			]
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(20, 0, 8, 0)
			[
				SNew(STextBlock).Font(Font(13, true)).ColorAndOpacity(AcademiaUI::Text)
				.Text_Lambda([this]()
				{
					const UAcademiaGameInstance* G = GI();
					if (!G || !G->Progress()) return FText::GetEmpty();
					const FAcademiaLevel L = G->GetLevel();
					return FText::FromString(FString::Printf(TEXT("Nivel %d · %s · %d XP"), L.N, *L.Name, G->Progress()->XP));
				})
			]
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
			[
				SNew(SBox).WidthOverride(160).HeightOverride(8)
				[
					SNew(SOverlay)
					+ SOverlay::Slot()[SNew(SImage).Image(White()).ColorAndOpacity(FLinearColor(1, 1, 1, 0.1f))]
					+ SOverlay::Slot().HAlign(HAlign_Left)
					[
						SNew(SBox).HeightOverride(8)
						.WidthOverride_Lambda([this]() { const UAcademiaGameInstance* G = GI(); return FOptionalSize(G ? 160.f * FMath::Clamp(G->GetLevel().Pct, 0.f, 1.f) : 0.f); })
						[
							SNew(SImage).Image(White()).ColorAndOpacity(Good)
						]
					]
				]
			]
			+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center).Padding(24, 0)
			[
				SNew(STextBlock).Font(Font(13)).ColorAndOpacity(Warn)
				.Text_Lambda([this]()
				{
					const UAcademiaGameInstance* G = GI();
					const FCareerMission* M = G ? G->ActiveMission() : nullptr;
					const FMissionTask* T = G ? G->ActiveTask() : nullptr;
					if (!M || !T) return FText::FromString(TEXT("Sin misión activa · Tab: menú"));
					return FText::FromString(FString::Printf(TEXT("Misión: %s  ·  %d/%d  %s"), *M->Title, G->Progress()->CurrentTask + 1, M->Tasks.Num(), *TaskLabel(G->Content(), *T)));
				})
			]
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 8, 0)
			[
				SNew(SBox).Visibility_Lambda([this]() { const UAcademiaGameInstance* G = GI(); return (G && G->ActiveTask()) ? EVisibility::Visible : EVisibility::Collapsed; })
				[
					Button(TEXT("▶ Continuar misión"), [this]() { RunActiveTask(); }, Warn, true, 13)
				]
			]
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
			[
				Button(TEXT("Menú"), [this]() { ShowMainMenu(); }, Accent, false, 13)
			]
		];
}

TSharedRef<SWidget> SAcademiaShell::BuildDialogBox()
{
	return SNew(SBox).WidthOverride(900)
		.Visibility_Lambda([this]() { return DialogLines.Num() ? EVisibility::Visible : EVisibility::Collapsed; })
		[
			SNew(SButton)
			.ButtonStyle(&FCoreStyle::Get().GetWidgetStyle<FButtonStyle>("NoBorder"))
			.ContentPadding(0)
			.OnClicked_Lambda([this]() { AdvanceDialog(); return FReply::Handled(); })
			[
				SNew(SBorder).BorderImage(White()).BorderBackgroundColor(Warn).Padding(FMargin(0, 3, 0, 0))
				[
					SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FLinearColor(0.03f, 0.035f, 0.05f, 0.96f)).Padding(FMargin(22, 16))
					[
						SNew(SVerticalBox)
						+ SVerticalBox::Slot().AutoHeight()
						[
							SNew(STextBlock).Font(Font(15, true)).ColorAndOpacity(Warn).Text_Lambda([this]() { return FText::FromString(DialogSpeaker); })
						]
						+ SVerticalBox::Slot().AutoHeight().Padding(0, 8)
						[
							SNew(STextBlock).Font(Font(18)).ColorAndOpacity(AcademiaUI::Text).AutoWrapText(true)
							.Text_Lambda([this]() { return DialogLines.IsValidIndex(DialogIndex) ? FText::FromString(DialogLines[DialogIndex]) : FText::GetEmpty(); })
						]
						+ SVerticalBox::Slot().AutoHeight().HAlign(HAlign_Right)
						[
							SNew(STextBlock).Font(Font(12)).ColorAndOpacity(Muted)
							.Text_Lambda([this]() { return FText::FromString(FString::Printf(TEXT("%d/%d · clic, E o Esc para continuar"), DialogIndex + 1, DialogLines.Num())); })
						]
					]
				]
			]
		];
}

// ------------------------------------------------------------------ Navegación

void SAcademiaShell::PushView(TSharedRef<SWidget> View, EShellLayout Layout)
{
	Stack.Add({ View, Layout });
	if (GI()) GI()->Sfx(EAcademiaSfx::Click);
	RefreshView();
}

void SAcademiaShell::Back()
{
	if (Stack.Num()) Stack.Pop();
	RefreshView();
}

void SAcademiaShell::CloseAll()
{
	Stack.Reset();
	RefreshView();
}

void SAcademiaShell::RefreshView()
{
	const bool bAny = Stack.Num() > 0;
	const bool bRight = bAny && Stack.Last().Layout == EShellLayout::RightPanel;
	FullSlot->SetContent(bAny && !bRight ? Stack.Last().Widget : SNullWidget::NullWidget);
	RightSlot->SetContent(bRight ? Stack.Last().Widget : SNullWidget::NullWidget);
	RightSlot->SetVisibility(bRight ? EVisibility::Visible : EVisibility::Collapsed);
	FullSlot->SetVisibility(bAny && !bRight ? EVisibility::Visible : EVisibility::Collapsed);

	if (AAcademiaPlayerController* P = PC())
	{
		bool bNeedFocus = false;
		for (const FEntry& E : Stack) bNeedFocus |= E.Layout == EShellLayout::RightPanel;
		if (!bNeedFocus && P->GetFocusedMachine()) P->FocusMachine(nullptr);
		P->SetUIMode(bAny && !bRight);
	}
	if (!bAny)
	{
		OnPartPicked = nullptr;
		OnPartHovered = nullptr;
	}
}

// ------------------------------------------------------------------ Menú principal

void SAcademiaShell::ShowMainMenu()
{
	Stack.Reset();
	UAcademiaGameInstance* G = GI();
	if (!G) return;
	const FCourseContent& C = G->Content();
	const FCareerMission* Active = G->ActiveMission();

	TSharedRef<SWrapBox> Tiles = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(12, 12));
	Tiles->AddSlot()[Tile(TEXT("Modo historia"), Active ? (TEXT("Continuar: ") + Active->Title) : FString(TEXT("Técnico de pruebas de nuevo ingreso: capacitación y luego el día a día en la línea.")), Warn, [this]() { ShowCareer(); })];
	Tiles->AddSlot()[Tile(TEXT("Caminar por la línea"), TEXT("Recorre la línea SMT a escala real. Acércate a una máquina y pulsa E."), Good, [this]() { CloseAll(); })];
	for (const FCourseMachine& M : C.Machines)
	{
		const FString Id = M.Id;
		const int32 Pct = FMath::RoundToInt(G->MachineProgress(M.Id) * 100.f);
		Tiles->AddSlot()[Tile(M.Name, FString::Printf(TEXT("%s · %d%% completado. %s"), *M.Brand, Pct, *M.Description), M.Color, [this, Id]() { ShowMachineHub(Id); })];
	}
	Tiles->AddSlot()[Tile(TEXT("Examen final"), FString::Printf(TEXT("%d preguntas de todo el curso. Mejor marca: %d%%"), C.FinalExam.Questions.Num(), G->Progress()->ExamBest.FindRef(TEXT("final"))), Bad, [this]()
	{
		if (const UAcademiaGameInstance* G2 = GI()) OpenExam(G2->Content().FinalExam, TEXT("Examen final integrador"));
	})];
	Tiles->AddSlot()[Tile(TEXT("Banco de repaso"), FString::Printf(TEXT("%d preguntas que has fallado, para repasarlas."), G->Progress()->Wrong.Num()), FLinearColor(0.65f, 0.48f, 1.f), [this]() { OpenReviewBank(); })];
	Tiles->AddSlot()[Tile(TEXT("Perfil e insignias"), TEXT("Tu nivel, rachas, insignias y avance por máquina."), Accent, [this]() { ShowProfile(); })];
	Tiles->AddSlot()[Tile(TEXT("Ajustes"), TEXT("Sonido, música, modo instructor, contenido y respaldo del progreso."), Muted, [this]() { ShowSettings(); })];
	Tiles->AddSlot()[Tile(TEXT("Salir"), TEXT("Guarda el progreso y cierra el juego."), Muted, [this]()
	{
		if (UAcademiaGameInstance* G2 = GI()) G2->SaveProgress();
		if (AAcademiaPlayerController* P = PC()) UKismetSystemLibrary::QuitGame(P, P, EQuitPreference::Quit, false);
	})];

	TSharedRef<SVerticalBox> Root = SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight()[AcademiaUI::Title(TEXT("Academia de Inspección"), 34)]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4, 0, 18)[Body(TEXT("Curso de pruebas estructurales: AOI Koh Young y ViTrox, AXI ViTrox V810, ICT Keysight y SPI Koh Young."), 16, Muted)]
		+ SVerticalBox::Slot().AutoHeight()[Tiles];
	if (C.Errors.Num())
	{
		Root->AddSlot().AutoHeight().Padding(0, 16, 0, 0)[Callout(FString::Printf(TEXT("Hay %d avisos al leer el contenido. Revisa Ajustes > Contenido."), C.Errors.Num()), Warn)];
	}
	PushView(Page(Root));
}

// ------------------------------------------------------------------ Modo historia

void SAcademiaShell::ShowCareer()
{
	UAcademiaGameInstance* G = GI();
	if (!G) return;
	const FCourseContent& C = G->Content();
	const UAcademiaSaveGame* S = G->Progress();

	TSharedRef<SVerticalBox> List = SNew(SVerticalBox);
	if (const FCareerMission* A = G->ActiveMission())
	{
		TSharedRef<SVerticalBox> Tasks = SNew(SVerticalBox);
		for (int32 i = 0; i < A->Tasks.Num(); ++i)
		{
			const bool bDone = i < S->CurrentTask, bCur = i == S->CurrentTask;
			Tasks->AddSlot().AutoHeight().Padding(0, 2)
			[
				SNew(STextBlock).Font(Font(14, bCur)).ColorAndOpacity(bDone ? Good : (bCur ? Warn : Muted))
				.Text(FText::FromString(FString::Printf(TEXT("%s %s"), bDone ? TEXT("✓") : (bCur ? TEXT("▶") : TEXT("○")), *TaskLabel(C, A->Tasks[i]))))
			];
		}
		List->AddSlot().AutoHeight().Padding(0, 0, 0, 12)
		[
			Card(SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight()[Tag(TEXT("MISIÓN ACTIVA · ") + MissionTypeName(A->Type).ToUpper(), Warn)]
				+ SVerticalBox::Slot().AutoHeight().Padding(0, 8, 0, 4)[AcademiaUI::Title(A->Title, 22)]
				+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 10)[Body(A->Brief, 15, Muted)]
				+ SVerticalBox::Slot().AutoHeight()[Tasks]
				+ SVerticalBox::Slot().AutoHeight().Padding(0, 12, 0, 0)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth()[Button(TEXT("▶ Continuar"), [this]() { RunActiveTask(); }, Warn, true)]
					+ SHorizontalBox::Slot().AutoWidth().Padding(8, 0)[Button(TEXT("Abandonar"), [this]() { if (UAcademiaGameInstance* G2 = GI()) G2->AbandonMission(); Back(); ShowCareer(); }, Muted)]
				])
		];
	}

	// Ruta de la historia agrupada por capítulos (tipo de misión en orden de aparición)
	int32 Done = 0;
	for (const FCareerMission& M : C.Missions) if (S->MissionsDone.Contains(M.Id)) ++Done;
	List->AddSlot().AutoHeight()[Body(FString::Printf(TEXT("Avance de la historia: %d de %d misiones"), Done, C.Missions.Num()), 15)];
	List->AddSlot().AutoHeight().Padding(0, 6, 0, 10)[Progress(C.Missions.Num() ? float(Done) / C.Missions.Num() : 0.f, Warn, 10)];
	FString LastChapter;
	for (const FCareerMission& M : C.Missions)
	{
		const FString Chapter = M.RewardTitle.IsEmpty() ? MissionTypeName(M.Type) : M.RewardTitle;
		if (Chapter != LastChapter) { List->AddSlot().AutoHeight()[Section(Chapter)]; LastChapter = Chapter; }
		const bool bDone = S->MissionsDone.Contains(M.Id);
		const bool bAvail = G->IsMissionAvailable(M);
		const bool bActive = S->CurrentMission == M.Id;
		const FCourseMachine* Mach = C.FindMachine(M.Machine);
		const FString Right = bActive ? TEXT("EN CURSO") : bDone ? TEXT("✓ HECHA") : bAvail ? FString::Printf(TEXT("+%d XP"), M.RewardXP) : TEXT("🔒 BLOQUEADA");
		const FString Id = M.Id;
		List->AddSlot().AutoHeight().Padding(0, 3)
		[
			Row(FString::Printf(TEXT("%d. %s%s — %s"), M.Order, *M.Title, Mach ? *(TEXT("  [") + Mach->Name + TEXT("]")) : TEXT(""), *M.Brief),
				Right, bActive ? Warn : bDone ? Good : bAvail ? Accent : Muted,
				[this, Id]()
				{
					UAcademiaGameInstance* G2 = GI();
					if (!G2) return;
					const FCareerMission* MM = G2->Content().FindMission(Id);
					if (!MM) return;
					G2->StartMission(Id);
					CloseAll();
					const TArray<FString> Intro = MM->MentorIntro.Num() ? MM->MentorIntro : TArray<FString>{ MM->Brief };
					ShowDialog(G2->Content().MentorName, Intro, [this]() { RunActiveTask(); });
				}, bAvail && !bActive)
		];
	}
	if (C.Missions.Num() == 0)
	{
		List->AddSlot().AutoHeight()[Callout(TEXT("No hay misiones. Agrega archivos JSON en CursoData/career/ (ver README del proyecto Unreal)."), Warn)];
	}

	PushView(Page(SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight()[Header(TEXT("Modo historia"), FString::Printf(TEXT("Eres técnico de pruebas de nuevo ingreso. %s, %s, te acompaña desde la capacitación hasta que la línea dependa de ti."), *C.MentorName, *C.MentorRole.ToLower()), [this]() { Back(); })]
		+ SVerticalBox::Slot().AutoHeight()[List]));
}

void SAcademiaShell::RunActiveTask()
{
	UAcademiaGameInstance* G = GI();
	if (!G) return;
	const FMissionTask* T = G->ActiveTask();
	if (!T) return;
	const FCourseContent& C = G->Content();
	const FString Mentor = C.MentorName;
	AAcademiaPlayerController* P = PC();

	switch (T->Kind)
	{
	case EMissionTask::Talk:
	{
		CloseAll();
		TArray<FString> Lines;
		T->Text.ParseIntoArray(Lines, TEXT("\n"), true);
		if (Lines.Num() == 0) Lines.Add(T->Text);
		ShowDialog(Mentor, Lines, [this]() { if (UAcademiaGameInstance* G2 = GI()) G2->NotifyEvent(EAcademiaEvent::TalkDone, FString()); });
		break;
	}
	case EMissionTask::GoTo:
	{
		CloseAll();
		AInspectionMachine* M = P ? P->FindMachine(T->Machine) : nullptr;
		if (M && P)
		{
			if (AMentorActor* Men = P->GetMentor()) Men->WalkTo(M->GetFrontLocation(90.f) + M->GetActorRightVector() * 120.f, M->GetFocusLocation());
			// Si ya estás junto a la máquina, cuenta de inmediato
			if (P->GetNearestMachine() == M) G->NotifyEvent(EAcademiaEvent::ReachedMachine, T->Machine);
		}
		Toast(TaskLabel(C, *T) + TEXT(". Sigue a tu mentora."));
		break;
	}
	case EMissionTask::Lesson:
	{
		const FCourseModule* Mod = nullptr;
		const FCourseLesson* L = C.FindLesson(T->Ref, &Mod);
		if (L && Mod) OpenLesson(*Mod, Mod->Lessons.IndexOfByPredicate([&](const FCourseLesson& X) { return X.Id == T->Ref; }));
		break;
	}
	case EMissionTask::Practice:
		if (const FPractice* Pr = C.FindPractice(T->Ref)) OpenPractice(*Pr);
		break;
	case EMissionTask::Maintenance:
		if (const FMaintProc* Mp = C.FindMaintenance(T->Ref)) OpenMaintenance(*Mp);
		break;
	case EMissionTask::Exam:
		if (T->Ref == TEXT("final")) OpenExam(C.FinalExam, TEXT("Examen final integrador"));
		else if (const FCourseModule* Mod = C.FindModule(T->Ref)) OpenExam(Mod->Exam, Mod->Title);
		break;
	case EMissionTask::Program:
		OpenSoftware(T->Mode, T->Machine);
		break;
	case EMissionTask::Quiz:
		ShowQuiz(T->Quiz, [this](bool bOk) { if (bOk) if (UAcademiaGameInstance* G2 = GI()) G2->NotifyEvent(EAcademiaEvent::QuizDone, FString()); });
		break;
	}
}

void SAcademiaShell::HandleMissionChanged(const FCareerMission* Mission, bool bCompleted)
{
	UAcademiaGameInstance* G = GI();
	if (!G || !Mission) return;
	if (bCompleted)
	{
		const TArray<FString> Outro = Mission->MentorOutro.Num() ? Mission->MentorOutro : TArray<FString>{ TEXT("Buen trabajo. Misión cumplida.") };
		CloseAll();
		ShowDialog(G->Content().MentorName, Outro, [this]() { ShowCareer(); });
		return;
	}
	const FMissionTask* T = G->ActiveTask();
	if (!T) return;
	// Las tareas de plática y pregunta corren solas; las demás esperan a que el jugador cierre la vista actual
	if (T->Kind == EMissionTask::Talk || T->Kind == EMissionTask::Quiz || T->Kind == EMissionTask::GoTo)
	{
		if (Stack.Num() == 0 || T->Kind != EMissionTask::GoTo) RunActiveTask();
		else Toast(TEXT("Siguiente: ") + TaskLabel(G->Content(), *T) + TEXT(" (▶ Continuar misión)"));
	}
	else
	{
		Toast(TEXT("Siguiente: ") + TaskLabel(G->Content(), *T) + TEXT(" (▶ Continuar misión)"));
	}
}

// ------------------------------------------------------------------ Diálogo y pregunta rápida

void SAcademiaShell::ShowDialog(const FString& Speaker, const TArray<FString>& Lines, TFunction<void()> OnDone)
{
	DialogSpeaker = Speaker;
	DialogLines = Lines;
	DialogIndex = 0;
	DialogDone = OnDone;
	if (DialogLines.Num() == 0) { if (OnDone) OnDone(); return; }
	if (AAcademiaPlayerController* P = PC())
	{
		if (AMentorActor* M = P->GetMentor()) M->SetTalking(true);
		P->SetUIMode(true);
	}
	if (GI()) GI()->Sfx(EAcademiaSfx::Toast);
}

void SAcademiaShell::AdvanceDialog()
{
	if (DialogLines.Num() == 0) return;
	if (GI()) GI()->Sfx(EAcademiaSfx::Click);
	if (++DialogIndex < DialogLines.Num()) return;
	DialogLines.Reset();
	DialogIndex = 0;
	if (AAcademiaPlayerController* P = PC())
	{
		if (AMentorActor* M = P->GetMentor()) M->SetTalking(false);
		P->SetUIMode(Stack.Num() > 0 && Stack.Last().Layout == EShellLayout::Full);
	}
	TFunction<void()> Done = MoveTemp(DialogDone);
	DialogDone = nullptr;
	if (Done) Done();
}

void SAcademiaShell::ShowQuiz(const FExamQuestion& Q, TFunction<void(bool)> OnAnswered)
{
	UAcademiaGameInstance* G = GI();
	const FString Mentor = G ? G->Content().MentorName : FString();
	TSharedRef<int32> Chosen = MakeShared<int32>(-1);
	TArray<int32> Order;
	for (int32 i = 0; i < Q.Options.Num(); ++i) Order.Add(i);
	if (Q.Type != TEXT("tf")) for (int32 i = Order.Num() - 1; i > 0; --i) Order.Swap(i, FMath::RandRange(0, i));
	TSharedRef<SVerticalBox> Opts = SNew(SVerticalBox);
	TSharedRef<SVerticalBox> Root = SNew(SVerticalBox);
	TSharedRef<SBox> FB = SNew(SBox);
	for (int32 k : Order)
	{
		Opts->AddSlot().AutoHeight().Padding(0, 4)
		[
			OptionButton(Q.Options[k], [this, k, Q, Chosen, OnAnswered, FB]()
			{
				if (*Chosen >= 0 && *Chosen == Q.Correct) return;
				*Chosen = k;
				const bool bOk = k == Q.Correct;
				if (UAcademiaGameInstance* G2 = GI()) { G2->RegisterAnswer(bOk, Q.Id); G2->Sfx(bOk ? EAcademiaSfx::Ok : EAcademiaSfx::Bad); }
				if (bOk)
				{
					FB->SetContent(SNew(SVerticalBox)
						+ SVerticalBox::Slot().AutoHeight()[Callout(TEXT("Correcto. ") + Q.Explain, Good)]
						+ SVerticalBox::Slot().AutoHeight().Padding(0, 10, 0, 0)[Button(TEXT("Continuar"), [this, OnAnswered]() { Back(); if (OnAnswered) OnAnswered(true); }, Good, true)]);
				}
				else
				{
					FB->SetContent(Callout(TEXT("No es lo mejor. Piénsalo otra vez: ") + Q.Explain, Bad));
					if (OnAnswered) OnAnswered(false);
				}
			},
			TAttribute<FSlateColor>::CreateLambda([k, Q, Chosen]() { return FSlateColor(*Chosen == k ? (k == Q.Correct ? Good : Bad) : Line); }),
			TAttribute<bool>::CreateLambda([Chosen, Q]() { return *Chosen != Q.Correct; }))
		];
	}
	Root->AddSlot().AutoHeight()[Tag(TEXT("PREGUNTA DE ") + Mentor.ToUpper(), Warn)];
	Root->AddSlot().AutoHeight().Padding(0, 10)[AcademiaUI::Title(Q.Q, 22)];
	Root->AddSlot().AutoHeight()[Opts];
	Root->AddSlot().AutoHeight().Padding(0, 12, 0, 0)[FB];
	PushView(Page(Card(Root), 820.f));
}

// ------------------------------------------------------------------ Máquina, módulos y vistas

void SAcademiaShell::ShowMachineHub(const FString& MachineId)
{
	UAcademiaGameInstance* G = GI();
	if (!G) return;
	const FCourseContent& C = G->Content();
	const FCourseMachine* M = C.FindMachine(MachineId);
	if (!M) return;
	const FLineStation* St = C.FindStationForMachine(MachineId);
	const FString Mode = FCourseContent::SoftwareModeFor(MachineId);
	const FString SwName = MachineId == TEXT("aoi_ky") ? TEXT("AOIGUI") : MachineId == TEXT("aoi_v510") ? TEXT("Smart GUI") : MachineId == TEXT("axi_v810") ? TEXT("V810 (Recipe / Production)") : MachineId == TEXT("ict") ? TEXT("i3070 / BT-Basic") : MachineId == TEXT("spi") ? TEXT("SPI (CEditor / ePM-SPI)") : TEXT("");

	TSharedRef<SVerticalBox> V = SNew(SVerticalBox);
	V->AddSlot().AutoHeight()[Header(M->Name, M->Brand + TEXT(" · ") + M->Description, [this]() { Back(); })];
	if (St)
	{
		V->AddSlot().AutoHeight().Padding(0, 0, 0, 10)[Body(FString::Printf(TEXT("Huella real: %.0f × %.0f × %.0f mm (ancho × fondo × alto), transportador a %.0f mm. %s"),
			St->SizeMM.X, St->SizeMM.Y, St->SizeMM.Z, St->ConveyorHeightMM, St->bApprox ? TEXT("Medida aproximada.") : *(TEXT("Fuente: ") + St->Source)), 13, Muted)];
	}
	V->AddSlot().AutoHeight().Padding(0, 0, 0, 6)[Progress(G->MachineProgress(MachineId), M->Color, 10)];

	TSharedRef<SHorizontalBox> Actions = SNew(SHorizontalBox);
	if (!SwName.IsEmpty())
		Actions->AddSlot().AutoWidth().Padding(0, 0, 8, 0)[Button(TEXT("Abrir software ") + SwName, [this, Mode, MachineId]() { OpenSoftware(Mode, MachineId); }, M->Color, true)];
	Actions->AddSlot().AutoWidth()[Button(TEXT("Ir a la máquina"), [this, MachineId]()
	{
		if (AAcademiaPlayerController* P = PC()) { CloseAll(); P->TeleportTo(P->FindMachine(MachineId)); }
	}, Accent)];
	V->AddSlot().AutoHeight().Padding(0, 8)[Actions];

	// Módulos
	const TArray<const FCourseModule*> Mods = C.ModulesFor(MachineId);
	if (Mods.Num()) V->AddSlot().AutoHeight()[Section(TEXT("Módulos"))];
	for (const FCourseModule* Mod : Mods)
	{
		const bool bUnlocked = G->IsUnlocked(*Mod);
		const int32 Pct = FMath::RoundToInt(G->ModuleProgress(*Mod) * 100.f);
		const FString Id = Mod->Id;
		V->AddSlot().AutoHeight().Padding(0, 3)
		[
			Row(Mod->Title, bUnlocked ? FString::Printf(TEXT("%d%%  ·  examen %d%%"), Pct, G->Progress()->ExamBest.FindRef(Mod->Id)) : FString(TEXT("🔒 Aprueba el anterior")),
				Pct >= 100 ? Good : Accent, [this, Id]() { if (const UAcademiaGameInstance* G2 = GI()) if (const FCourseModule* MM = G2->Content().FindModule(Id)) OpenModule(*MM); }, bUnlocked)
		];
	}
	// Prácticas
	bool bHeader = false;
	for (const FPractice& Pr : C.Practices)
	{
		if (Pr.Machine != MachineId) continue;
		if (!bHeader) { V->AddSlot().AutoHeight()[Section(TEXT("Prácticas de creación y debug"))]; bHeader = true; }
		const FString Id = Pr.Id;
		const int32 Best = G->Progress()->PracticeBest.FindRef(Pr.Id);
		V->AddSlot().AutoHeight().Padding(0, 3)
		[
			Row((Pr.Kind == TEXT("debug") ? TEXT("Debug · ") : TEXT("Creación · ")) + Pr.Title, Best ? FString::Printf(TEXT("%d%%"), Best) : FString(TEXT("Nueva")), Best >= 70 ? Good : Accent,
				[this, Id]() { if (const UAcademiaGameInstance* G2 = GI()) if (const FPractice* PP = G2->Content().FindPractice(Id)) OpenPractice(*PP); })
		];
	}
	// Mantenimiento
	bHeader = false;
	for (const FMaintProc& Mp : C.Maintenance)
	{
		if (Mp.Machine != MachineId) continue;
		if (!bHeader) { V->AddSlot().AutoHeight()[Section(TEXT("Taller de mantenimiento"))]; bHeader = true; }
		const FString Id = Mp.Id;
		const int32 Best = G->Progress()->MaintBest.FindRef(Mp.Id);
		V->AddSlot().AutoHeight().Padding(0, 3)
		[
			Row(FString::Printf(TEXT("[%s] %s"), *Mp.Frequency, *Mp.Title), Best ? FString::Printf(TEXT("%d%%"), Best) : FString(TEXT("Pendiente")), Best >= 70 ? Good : Warn,
				[this, Id]() { if (const UAcademiaGameInstance* G2 = GI()) if (const FMaintProc* PP = G2->Content().FindMaintenance(Id)) OpenMaintenance(*PP); })
		];
	}
	PushView(Page(V));
}

void SAcademiaShell::OpenModule(const FCourseModule& Module)
{
	UAcademiaGameInstance* G = GI();
	if (!G) return;
	const FString ModId = Module.Id;
	TSharedRef<SVerticalBox> V = SNew(SVerticalBox);
	V->AddSlot().AutoHeight()[Header(Module.Title, Module.Summary, [this]() { Back(); })];
	for (int32 i = 0; i < Module.Lessons.Num(); ++i)
	{
		const bool bDone = G->Progress()->Lessons.Contains(Module.Lessons[i].Id);
		V->AddSlot().AutoHeight().Padding(0, 3)
		[
			Row(FString::Printf(TEXT("Lección %d. %s"), i + 1, *Module.Lessons[i].Title), bDone ? TEXT("✓ Vista") : TEXT("Pendiente"), bDone ? Good : Muted,
				[this, ModId, i]() { if (const UAcademiaGameInstance* G2 = GI()) if (const FCourseModule* M = G2->Content().FindModule(ModId)) OpenLesson(*M, i); })
		];
	}
	if (Module.Lessons.Num() == 0)
		V->AddSlot().AutoHeight()[Callout(TEXT("Este módulo sólo tiene examen por ahora. Las lecciones se agregan en su JSON."), Accent)];
	V->AddSlot().AutoHeight().Padding(0, 16, 0, 0)
	[
		Button(FString::Printf(TEXT("Presentar examen (%d preguntas) · mejor %d%%"), Module.Exam.Questions.Num(), G->Progress()->ExamBest.FindRef(Module.Id)),
			[this, ModId]() { if (const UAcademiaGameInstance* G2 = GI()) if (const FCourseModule* M = G2->Content().FindModule(ModId)) OpenExam(M->Exam, M->Title); }, Warn, true)
	];
	PushView(Page(V, 900.f));
}

void SAcademiaShell::OpenLesson(const FCourseModule& Module, int32 LessonIndex)
{
	if (!Module.Lessons.IsValidIndex(LessonIndex)) return;
	PushView(SNew(SLessonView).Shell(SharedThis(this)).Module(&Module).LessonIndex(LessonIndex));
}

void SAcademiaShell::OpenExam(const FCourseExam& Exam, const FString& Title)
{
	PushView(SNew(SExamView).Shell(SharedThis(this)).Exam(Exam).Title(Title).bPractice(false));
}

void SAcademiaShell::OpenReviewBank()
{
	UAcademiaGameInstance* G = GI();
	if (!G) return;
	FCourseExam E;
	E.Id = TEXT("repaso");
	E.Title = TEXT("Banco de repaso");
	auto Collect = [&](const FCourseExam& Src) { for (const FExamQuestion& Q : Src.Questions) if (G->Progress()->Wrong.Contains(Q.Id)) E.Questions.Add(Q); };
	for (const FCourseModule& M : G->Content().Modules) Collect(M.Exam);
	Collect(G->Content().FinalExam);
	if (E.Questions.Num() == 0) { Toast(TEXT("No tienes preguntas falladas. ¡Bien!")); return; }
	PushView(SNew(SExamView).Shell(SharedThis(this)).Exam(E).Title(TEXT("Banco de repaso")).bPractice(true));
}

void SAcademiaShell::OpenPractice(const FPractice& Practice)
{
	PushView(SNew(SPracticeView).Shell(SharedThis(this)).Practice(&Practice));
}

void SAcademiaShell::OpenMaintenance(const FMaintProc& Proc)
{
	AAcademiaPlayerController* P = PC();
	AInspectionMachine* M = P ? P->FindMachine(Proc.Machine) : nullptr;
	if (!M) { Toast(TEXT("Esa máquina no está en la línea (revisa content/line.json).")); return; }
	P->FocusMachine(M);
	PushView(SNew(SMaintenanceView).Shell(SharedThis(this)).Proc(&Proc).Machine(M), EShellLayout::RightPanel);
}

void SAcademiaShell::OpenSoftware(const FString& Mode, const FString& MachineId)
{
	PushView(SNew(SMachineSoftware).Shell(SharedThis(this)).Mode(Mode).MachineId(MachineId));
}

// ------------------------------------------------------------------ Perfil y ajustes

void SAcademiaShell::ShowProfile()
{
	UAcademiaGameInstance* G = GI();
	if (!G) return;
	const UAcademiaSaveGame* S = G->Progress();
	const FAcademiaLevel L = G->GetLevel();
	TSharedRef<SVerticalBox> V = SNew(SVerticalBox);
	V->AddSlot().AutoHeight()[Header(FString::Printf(TEXT("Nivel %d · %s"), L.N, *L.Name), FString::Printf(TEXT("%d XP · siguiente nivel en %d XP · racha actual %d, mejor racha %d · %d días seguidos"), S->XP, FMath::Max(0, L.To - S->XP), S->Streak, S->BestStreak, G->DayStreak()), [this]() { Back(); })];
	V->AddSlot().AutoHeight()[Progress(L.Pct, Good, 12)];
	V->AddSlot().AutoHeight()[Section(TEXT("Avance por máquina"))];
	for (const FCourseMachine& M : G->Content().Machines)
	{
		V->AddSlot().AutoHeight().Padding(0, 4)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().FillWidth(0.4f).VAlign(VAlign_Center)[Body(M.Name, 14)]
			+ SHorizontalBox::Slot().FillWidth(0.6f).VAlign(VAlign_Center)[Progress(G->MachineProgress(M.Id), M.Color, 10)]
		];
	}
	V->AddSlot().AutoHeight()[Section(TEXT("Insignias"))];
	TSharedRef<SWrapBox> Badges = SNew(SWrapBox).UseAllottedSize(true).InnerSlotPadding(FVector2D(10, 10));
	for (const FAcademiaBadge& B : G->GetBadges())
	{
		Badges->AddSlot()
		[
			SNew(SBox).WidthOverride(250).HeightOverride(80)
			[
				Card(SNew(SVerticalBox)
					+ SVerticalBox::Slot().AutoHeight()[SNew(STextBlock).Text(FText::FromString((B.bEarned ? TEXT("★ ") : TEXT("☆ ")) + B.Name)).Font(Font(14, true)).ColorAndOpacity(B.bEarned ? B.Color : Muted)]
					+ SVerticalBox::Slot().AutoHeight()[Body(B.Desc, 12, Muted)], B.bEarned ? Panel2 : Panel, 10)
			]
		];
	}
	V->AddSlot().AutoHeight()[Badges];
	PushView(Page(V));
}

void SAcademiaShell::ShowSettings()
{
	UAcademiaGameInstance* G = GI();
	if (!G) return;
	UAcademiaSaveGame* S = G->Progress();
	const FCourseContent& C = G->Content();
	auto Check = [this](const FString& Label, TFunction<bool()> Get, TFunction<void(bool)> Set)
	{
		return SNew(SCheckBox)
			.IsChecked_Lambda([Get]() { return Get() ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
			.OnCheckStateChanged_Lambda([this, Set](ECheckBoxState St) { Set(St == ECheckBoxState::Checked); if (UAcademiaGameInstance* G2 = GI()) { G2->ApplyAudioSettings(); G2->SaveProgress(); } })
			[
				SNew(STextBlock).Text(FText::FromString(Label)).Font(Font(15)).ColorAndOpacity(AcademiaUI::Text)
			];
	};
	TWeakObjectPtr<UAcademiaSaveGame> WS = S;
	TSharedRef<SVerticalBox> V = SNew(SVerticalBox);
	V->AddSlot().AutoHeight()[Header(TEXT("Ajustes"), TEXT("Se guardan automáticamente."), [this]() { Back(); })];
	V->AddSlot().AutoHeight().Padding(0, 4)[Check(TEXT("Efectos de sonido"), [WS]() { return WS.IsValid() && WS->bSound; }, [WS](bool b) { if (WS.IsValid()) WS->bSound = b; })];
	V->AddSlot().AutoHeight().Padding(0, 4)[Check(TEXT("Música"), [WS]() { return WS.IsValid() && WS->bMusic; }, [WS](bool b) { if (WS.IsValid()) WS->bMusic = b; })];
	V->AddSlot().AutoHeight().Padding(0, 4)
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 12, 0)[Body(TEXT("Volumen de la música"), 15)]
		+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
		[
			SNew(SSlider).MinValue(0.f).MaxValue(1.f)
			.Value_Lambda([WS]() { return WS.IsValid() ? WS->MusicVolume : 0.f; })
			.OnValueChanged_Lambda([this, WS](float Val) { if (WS.IsValid()) WS->MusicVolume = Val; if (UAcademiaGameInstance* G2 = GI()) G2->ApplyAudioSettings(); })
			.OnMouseCaptureEnd_Lambda([this]() { if (UAcademiaGameInstance* G2 = GI()) G2->SaveProgress(); })
		]
	];
	V->AddSlot().AutoHeight().Padding(0, 4)[Check(TEXT("Modo instructor: todo desbloqueado"), [WS]() { return WS.IsValid() && WS->bFreeMode; }, [WS](bool b) { if (WS.IsValid()) WS->bFreeMode = b; })];
	V->AddSlot().AutoHeight().Padding(0, 4)[Check(TEXT("Exámenes con tiempo (60 s por pregunta)"), [WS]() { return WS.IsValid() && WS->bTimer; }, [WS](bool b) { if (WS.IsValid()) WS->bTimer = b; })];

	V->AddSlot().AutoHeight()[Section(TEXT("Respaldo del progreso"))];
	V->AddSlot().AutoHeight()
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)[Button(TEXT("Copiar progreso al portapapeles"), [this]() { if (UAcademiaGameInstance* G2 = GI()) { FPlatformApplicationMisc::ClipboardCopy(*G2->ExportProgress()); Toast(TEXT("Progreso copiado.")); } }, Accent)]
		+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)[Button(TEXT("Pegar progreso del portapapeles"), [this]()
		{
			FString Txt;
			FPlatformApplicationMisc::ClipboardPaste(Txt);
			if (UAcademiaGameInstance* G2 = GI()) Toast(G2->ImportProgress(Txt) ? TEXT("Progreso importado.") : TEXT("El portapapeles no tiene un progreso válido."));
		}, Accent)]
		+ SHorizontalBox::Slot().AutoWidth()[Button(TEXT("Reiniciar todo"), [this]() { if (UAcademiaGameInstance* G2 = GI()) { G2->ResetProgress(); Toast(TEXT("Progreso reiniciado.")); } }, Bad)]
	];

	V->AddSlot().AutoHeight()[Section(TEXT("Contenido"))];
	V->AddSlot().AutoHeight()[Body(FString::Printf(TEXT("Carpeta: %s\n%d máquinas · %d módulos · %d mantenimientos · %d prácticas · %d misiones · %d estaciones de línea · tarjeta: %s"),
		*C.RootDir, C.Machines.Num(), C.Modules.Num(), C.Maintenance.Num(), C.Practices.Num(), C.Missions.Num(), C.Line.Num(), C.Board.IsValid() ? *C.Board->Name : TEXT("ninguna")), 13, Muted)];
	V->AddSlot().AutoHeight().Padding(0, 6)[Button(TEXT("Volver a leer el contenido"), [this]() { if (UAcademiaGameInstance* G2 = GI()) { G2->ReloadContent(); Toast(TEXT("Contenido recargado. Reinicia el juego para ver cambios en la línea 3D.")); ShowMainMenu(); } }, Accent)];
	for (const FString& E : C.Errors) V->AddSlot().AutoHeight().Padding(0, 2)[Callout(E, Warn)];
	PushView(Page(V, 900.f));
}

// ------------------------------------------------------------------ Avisos y celebración

void SAcademiaShell::Toast(const FString& Msg)
{
	Toasts.Add({ Msg, FSlateApplication::Get().GetCurrentTime() + 3.5 });
	if (Toasts.Num() > 5) Toasts.RemoveAt(0);
	bToastsDirty = true;
}

void SAcademiaShell::Celebrate()
{
	if (ConfettiWidget.IsValid()) ConfettiWidget->Fire(FSlateApplication::Get().GetCurrentTime());
}

void SAcademiaShell::SetHint(const FString& Hint)
{
	HintText = Hint;
}

void SAcademiaShell::Tick(const FGeometry& AllottedGeometry, const double InCurrentTime, const float InDeltaTime)
{
	SCompoundWidget::Tick(AllottedGeometry, InCurrentTime, InDeltaTime);
	const int32 Before = Toasts.Num();
	Toasts.RemoveAll([InCurrentTime](const FToast& T) { return T.Until < InCurrentTime; });
	if (Before != Toasts.Num()) bToastsDirty = true;
	if (bToastsDirty && ToastBox.IsValid())
	{
		bToastsDirty = false;
		ToastBox->ClearChildren();
		for (const FToast& T : Toasts)
		{
			ToastBox->AddSlot().AutoHeight().Padding(0, 0, 0, 6)
			[
				SNew(SBorder).BorderImage(White()).BorderBackgroundColor(FLinearColor(0.05f, 0.06f, 0.08f, 0.95f)).Padding(FMargin(12, 8))
				[
					SNew(STextBlock).Text(FText::FromString(T.Msg)).Font(Font(14)).ColorAndOpacity(AcademiaUI::Text).AutoWrapText(true)
				]
			];
		}
	}
}

FReply SAcademiaShell::OnKeyDown(const FGeometry& MyGeometry, const FKeyEvent& InKeyEvent)
{
	// Las teclas del juego (E, Tab, Esc) las maneja el PlayerController; aquí sólo dejamos pasar.
	return FReply::Unhandled();
}
