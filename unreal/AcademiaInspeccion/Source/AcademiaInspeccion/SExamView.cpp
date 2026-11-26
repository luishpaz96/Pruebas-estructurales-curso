#include "SExamView.h"

#include "AcademiaGameInstance.h"
#include "AcademiaSaveGame.h"
#include "AcademiaStyle.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
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

	FString TypeLabel(const FString& T)
	{
		if (T == TEXT("tf")) return TEXT("Verdadero o falso");
		if (T == TEXT("case")) return TEXT("Caso práctico");
		return TEXT("Opción múltiple");
	}

	FString Letter(int32 Pos)
	{
		return FString::Printf(TEXT("%c"), TEXT('A') + Pos);
	}
}

UAcademiaGameInstance* SExamView::GI() const
{
	TSharedPtr<SAcademiaShell> S = Shell.Pin();
	return S.IsValid() ? S->GI() : nullptr;
}

bool SExamView::UseTimer() const
{
	UAcademiaGameInstance* G = GI();
	return G && G->Progress() && G->Progress()->bTimer;
}

void SExamView::Construct(const FArguments& InArgs)
{
	Shell = InArgs._Shell;
	Exam = InArgs._Exam;
	Title = InArgs._Title;
	bPractice = InArgs._bPractice;

	ContentBox = SNew(SBox);
	ChildSlot
	[
		SNew(SScrollBox)
		+ SScrollBox::Slot()
		.HAlign(HAlign_Center)
		.Padding(20, 16)
		[
			SNew(SBox).MaxDesiredWidth(900.f)
			[
				ContentBox.ToSharedRef()
			]
		]
	];

	Reset();
	Rebuild();
}

void SExamView::Reset()
{
	Phase = EPhase::Intro;
	Cur = 0;
	bLocked = false;
	Correct = 0;
	Pct = 0;
	Orders.Reset();
	Answers.Init(-1, Exam.Questions.Num());
	for (const FExamQuestion& Q : Exam.Questions)
	{
		TArray<int32> O;
		for (int32 i = 0; i < Q.Options.Num(); ++i) O.Add(i);
		if (Q.Type != TEXT("tf")) ShuffleInts(O);   // verdadero/falso conserva su orden
		Orders.Add(MoveTemp(O));
	}
}

void SExamView::Rebuild()
{
	if (!ContentBox.IsValid()) return;
	switch (Phase)
	{
	case EPhase::Intro:    ContentBox->SetContent(BuildIntro()); break;
	case EPhase::Question: ContentBox->SetContent(BuildQuestion()); break;
	case EPhase::Result:   ContentBox->SetContent(BuildResult()); break;
	}
}

TSharedRef<SWidget> SExamView::BuildIntro()
{
	TWeakPtr<SAcademiaShell> WShell = Shell;
	const bool bT = UseTimer();
	TSharedRef<SVerticalBox> Info = SNew(SVerticalBox);
	Info->AddSlot().AutoHeight().Padding(0, 0, 0, 8)[ Body(FString::Printf(TEXT("Preguntas: %d"), Exam.Questions.Num()), 16) ];
	Info->AddSlot().AutoHeight().Padding(0, 0, 0, 8)[ Body(FString::Printf(TEXT("Para aprobar: %d%%"), Exam.PassScore), 16) ];
	Info->AddSlot().AutoHeight().Padding(0, 0, 0, 8)[ Body(bT ? TEXT("Cronómetro: activado (60 segundos por pregunta)") : TEXT("Cronómetro: apagado (puedes activarlo en Ajustes)"), 16) ];
	Info->AddSlot().AutoHeight()[ Body(TEXT("Al elegir una respuesta verás si es correcta y por qué."), 14, Muted) ];

	TSharedRef<SHorizontalBox> Btns = SNew(SHorizontalBox);
	if (Exam.Questions.Num() > 0)
	{
		Btns->AddSlot().AutoWidth().Padding(0, 0, 10, 0)[ Button(TEXT("Comenzar"), [this]() { Start(); }, Accent, true) ];
	}
	Btns->AddSlot().AutoWidth()[ Button(TEXT("Volver"), [WShell]() { if (TSharedPtr<SAcademiaShell> S = WShell.Pin()) S->Back(); }) ];

	return SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 12)[ AcademiaUI::Title(Title.IsEmpty() ? Exam.Title : Title) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 14)[ Card(Info) ]
		+ SVerticalBox::Slot().AutoHeight()[ Btns ];
}

void SExamView::Start()
{
	if (UAcademiaGameInstance* G = GI()) G->Sfx(EAcademiaSfx::Click);
	Phase = EPhase::Question;
	Cur = 0;
	bLocked = false;
	bTimed = UseTimer();
	TimeLeft = 60.f;
	Rebuild();
}

TSharedRef<SWidget> SExamView::BuildQuestion()
{
	const FExamQuestion& Q = Exam.Questions[Cur];
	const TArray<int32>& Order = Orders[Cur];
	const int32 N = Exam.Questions.Num();
	TWeakPtr<SAcademiaShell> WShell = Shell;

	TSharedRef<SVerticalBox> Col = SNew(SVerticalBox);

	// Cabecera: etiqueta, número y tiempo
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 8)
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 10, 0)[ Tag(TypeLabel(Q.Type), Accent) ]
		+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
		[ SNew(STextBlock).Text(FText::FromString(FString::Printf(TEXT("Pregunta %d de %d"), Cur + 1, N))).Font(Font(13)).ColorAndOpacity(Muted) ]
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
		[
			SNew(STextBlock)
			.Visibility_Lambda([this]() { return bTimed ? EVisibility::Visible : EVisibility::Collapsed; })
			.Text_Lambda([this]()
			{
				const int32 S = FMath::Max(0, FMath::CeilToInt(TimeLeft));
				return FText::FromString(FString::Printf(TEXT("Tiempo: 0:%02d"), S));
			})
			.Font(Font(16, true))
			.ColorAndOpacity_Lambda([this]() { return FSlateColor(TimeLeft <= 10.f ? Bad : Text); })
		]
	];
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 12)[ Progress(float(Cur) / float(FMath::Max(1, N)), Accent) ];

	// Pregunta y opciones
	TSharedRef<SVerticalBox> Card_ = SNew(SVerticalBox);
	Card_->AddSlot().AutoHeight().Padding(0, 0, 0, 10)[ Body(Q.Q, 18, Text) ];
	for (int32 Pos = 0; Pos < Order.Num(); ++Pos)
	{
		const int32 Orig = Order[Pos];
		Card_->AddSlot().AutoHeight().Padding(0, 3)
		[
			OptionButton(Letter(Pos) + TEXT(".  ") + Q.Options[Orig],
				[this, Orig]() { Choose(Orig); },
				TAttribute<FSlateColor>::CreateLambda([this, Orig]() -> FSlateColor
				{
					if (!bLocked) return FSlateColor(Line);
					const FExamQuestion& QQ = Exam.Questions[Cur];
					if (Orig == QQ.Correct) return FSlateColor(Good);
					if (Orig == Answers[Cur]) return FSlateColor(Bad);
					return FSlateColor(Line);
				}),
				TAttribute<bool>::CreateLambda([this]() { return !bLocked; }))
		];
	}
	FeedbackBox = SNew(SVerticalBox);
	Card_->AddSlot().AutoHeight().Padding(0, 10, 0, 0)[ FeedbackBox.ToSharedRef() ];
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 12)[ Card(Card_) ];

	Col->AddSlot().AutoHeight()
	[
		Button(TEXT("Salir del examen"), [WShell]() { if (TSharedPtr<SAcademiaShell> S = WShell.Pin()) S->Back(); })
	];
	return Col;
}

void SExamView::Choose(int32 OrigIndex)
{
	if (bLocked || !Exam.Questions.IsValidIndex(Cur)) return;
	bLocked = true;
	Answers[Cur] = OrigIndex;
	const FExamQuestion& Q = Exam.Questions[Cur];
	const bool bOk = (OrigIndex == Q.Correct);
	if (bOk) ++Correct;
	if (UAcademiaGameInstance* G = GI())
	{
		G->RegisterAnswer(bOk, Q.Id);
		G->Sfx(bOk ? EAcademiaSfx::Ok : EAcademiaSfx::Bad);
	}
	ShowFeedback();
}

void SExamView::ShowFeedback()
{
	if (!FeedbackBox.IsValid()) return;
	const FExamQuestion& Q = Exam.Questions[Cur];
	const bool bOk = (Answers[Cur] == Q.Correct);
	FString Msg = bOk ? TEXT("¡Correcto! ") : (Answers[Cur] < 0 ? TEXT("Se acabó el tiempo. ") : TEXT("Incorrecto. "));
	Msg += Q.Explain;
	if (!Q.Section.IsEmpty()) Msg += TEXT("  (Sección ") + Q.Section + TEXT(")");
	const bool bLast = (Cur >= Exam.Questions.Num() - 1);
	FeedbackBox->ClearChildren();
	FeedbackBox->AddSlot().AutoHeight().Padding(0, 0, 0, 10)[ Callout(Msg, bOk ? Good : Bad) ];
	FeedbackBox->AddSlot().AutoHeight()
	[
		Button(bLast ? TEXT("Ver resultado") : TEXT("Siguiente"), [this]() { Next(); }, Accent, true)
	];
}

void SExamView::Next()
{
	if (Cur + 1 >= Exam.Questions.Num())
	{
		Finish();
		return;
	}
	++Cur;
	bLocked = false;
	TimeLeft = 60.f;
	if (UAcademiaGameInstance* G = GI()) G->Sfx(EAcademiaSfx::Click);
	Rebuild();
}

void SExamView::Finish()
{
	const int32 N = FMath::Max(1, Exam.Questions.Num());
	Pct = FMath::RoundToInt(100.f * float(Correct) / float(N));
	Phase = EPhase::Result;
	if (UAcademiaGameInstance* G = GI())
	{
		if (!bPractice) G->RecordExam(Exam.Id, Pct);
		if (Pct >= Exam.PassScore)
		{
			if (TSharedPtr<SAcademiaShell> S = Shell.Pin()) S->Celebrate();
		}
	}
	Rebuild();
}

void SExamView::Tick(const FGeometry& AllottedGeometry, const double InCurrentTime, const float InDeltaTime)
{
	SCompoundWidget::Tick(AllottedGeometry, InCurrentTime, InDeltaTime);
	if (Phase == EPhase::Question && bTimed && !bLocked)
	{
		TimeLeft -= InDeltaTime;
		if (TimeLeft <= 0.f)
		{
			TimeLeft = 0.f;
			Choose(-1);   // sin respuesta: cuenta como incorrecta
		}
	}
}

TSharedRef<SWidget> SExamView::BuildResult()
{
	const int32 N = Exam.Questions.Num();
	const bool bPass = Pct >= Exam.PassScore;
	const FLinearColor C = bPass ? Good : Bad;
	TWeakPtr<SAcademiaShell> WShell = Shell;

	TSharedRef<SVerticalBox> Sum = SNew(SVerticalBox);
	Sum->AddSlot().AutoHeight().HAlign(HAlign_Center)
	[ SNew(STextBlock).Text(FText::FromString(FString::Printf(TEXT("%d%%"), Pct))).Font(Font(56, true)).ColorAndOpacity(C) ];
	Sum->AddSlot().AutoHeight().HAlign(HAlign_Center).Padding(0, 4)
	[ SNew(STextBlock).Text(FText::FromString(bPass ? TEXT("Aprobado") : TEXT("Reprobado"))).Font(Font(24, true)).ColorAndOpacity(C) ];
	Sum->AddSlot().AutoHeight().HAlign(HAlign_Center).Padding(0, 4)
	[ Body(FString::Printf(TEXT("%d de %d correctas. Mínimo para aprobar: %d%%."), Correct, N, Exam.PassScore), 15, Muted) ];

	auto MakeBtns = [this, WShell]() -> TSharedRef<SWidget>
	{
		return SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 10, 0)
			[ Button(TEXT("Repetir"), [this]() { Reset(); Start(); }, Accent, true) ]
			+ SHorizontalBox::Slot().AutoWidth()
			[ Button(TEXT("Volver"), [WShell]() { if (TSharedPtr<SAcademiaShell> S = WShell.Pin()) S->Back(); }) ];
	};

	TSharedRef<SVerticalBox> Col = SNew(SVerticalBox);
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 12)[ AcademiaUI::Title(Title.IsEmpty() ? Exam.Title : Title) ];
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 12)[ Card(Sum) ];
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 16)[ MakeBtns() ];
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 8)
	[ SNew(STextBlock).Text(FText::FromString(TEXT("Revisión"))).Font(Font(20, true)).ColorAndOpacity(Text) ];

	// Revisión de cada pregunta
	for (int32 i = 0; i < N; ++i)
	{
		const FExamQuestion& Q = Exam.Questions[i];
		const int32 A = Answers.IsValidIndex(i) ? Answers[i] : -1;
		const bool bOk = (A == Q.Correct);

		TSharedRef<SVerticalBox> R = SNew(SVerticalBox);
		R->AddSlot().AutoHeight().Padding(0, 0, 0, 6)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 10, 0)[ Tag(bOk ? TEXT("Correcta") : TEXT("Incorrecta"), bOk ? Good : Bad) ]
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
			[ SNew(STextBlock).Text(FText::FromString(FString::Printf(TEXT("Pregunta %d"), i + 1))).Font(Font(13)).ColorAndOpacity(Muted) ]
		];
		R->AddSlot().AutoHeight().Padding(0, 0, 0, 6)[ Body(Q.Q, 16, Text) ];
		if (!bOk)
		{
			const FString Mine = (A >= 0 && Q.Options.IsValidIndex(A)) ? Q.Options[A] : FString(TEXT("Sin responder"));
			R->AddSlot().AutoHeight().Padding(0, 2)[ Body(TEXT("Tu respuesta: ") + Mine, 14, Bad) ];
		}
		const FString Right = Q.Options.IsValidIndex(Q.Correct) ? Q.Options[Q.Correct] : FString();
		R->AddSlot().AutoHeight().Padding(0, 2)[ Body(TEXT("Respuesta correcta: ") + Right, 14, Good) ];
		if (!Q.Explain.IsEmpty()) R->AddSlot().AutoHeight().Padding(0, 6, 0, 0)[ Body(Q.Explain, 14, Muted) ];
		if (!Q.Section.IsEmpty()) R->AddSlot().AutoHeight().Padding(0, 4, 0, 0)[ Body(TEXT("Sección ") + Q.Section, 13, Muted) ];

		Col->AddSlot().AutoHeight().Padding(0, 4)[ Card(R) ];
	}
	Col->AddSlot().AutoHeight().Padding(0, 12, 0, 30)[ MakeBtns() ];
	return Col;
}
