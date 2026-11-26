#include "SLessonView.h"

#include "AcademiaGameInstance.h"
#include "AcademiaStyle.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Text/STextBlock.h"

using namespace AcademiaUI;

namespace
{
	// Mezcla simple (Fisher-Yates)
	void ShuffleInts(TArray<int32>& A)
	{
		for (int32 i = A.Num() - 1; i > 0; --i)
		{
			A.Swap(i, FMath::RandRange(0, i));
		}
	}
}

void SLessonView::Construct(const FArguments& InArgs)
{
	Shell = InArgs._Shell;
	Module = InArgs._Module;
	LessonIndex = InArgs._LessonIndex;

	if (!Module || !Module->Lessons.IsValidIndex(LessonIndex))
	{
		ChildSlot[ SNew(STextBlock).Text(FText::FromString(TEXT("Lección no disponible."))).Font(Font(16)).ColorAndOpacity(Text) ];
		return;
	}

	const FCourseLesson& L = Module->Lessons[LessonIndex];
	const int32 Total = Module->Lessons.Num();

	// Reto rápido: pregunta (LessonIndex % tamaño del examen), opciones mezcladas
	if (Module->Exam.Questions.Num() > 0)
	{
		Question = &Module->Exam.Questions[LessonIndex % Module->Exam.Questions.Num()];
		for (int32 i = 0; i < Question->Options.Num(); ++i) Order.Add(i);
		ShuffleInts(Order);
	}

	TSharedRef<SVerticalBox> Col = SNew(SVerticalBox);

	// Encabezado
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 6)
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 10, 0)[ Tag(Module->Title, Accent) ]
		+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center)
		[ SNew(STextBlock).Text(FText::FromString(FString::Printf(TEXT("Lección %d de %d"), LessonIndex + 1, Total))).Font(Font(13)).ColorAndOpacity(Muted) ]
	];
	Col->AddSlot().AutoHeight().Padding(0, 0, 0, 14)[ Title(L.Title) ];

	// Bloques
	for (const FLessonBlock& B : L.Blocks)
	{
		if (B.Kind == TEXT("bullets"))
		{
			TSharedRef<SVerticalBox> Items = SNew(SVerticalBox);
			for (const FString& It : B.Items)
			{
				Items->AddSlot().AutoHeight().Padding(0, 2)
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Top).Padding(8, 0, 8, 0)[ Body(TEXT("•")) ]
					+ SHorizontalBox::Slot().FillWidth(1.f)[ Body(It) ]
				];
			}
			Col->AddSlot().AutoHeight().Padding(0, 4, 0, 8)[ Items ];
		}
		else if (B.Kind == TEXT("tip"))
		{
			Col->AddSlot().AutoHeight().Padding(0, 6)[ Callout(TEXT("Consejo: ") + B.Text, Good) ];
		}
		else if (B.Kind == TEXT("warning"))
		{
			Col->AddSlot().AutoHeight().Padding(0, 6)[ Callout(TEXT("Cuidado: ") + B.Text, Bad) ];
		}
		else
		{
			Col->AddSlot().AutoHeight().Padding(0, 4, 0, 8)[ Body(B.Text) ];
		}
	}

	// Puntos clave
	if (L.KeyPoints.Num() > 0)
	{
		TSharedRef<SVerticalBox> Pts = SNew(SVerticalBox);
		Pts->AddSlot().AutoHeight().Padding(0, 0, 0, 6)
		[ SNew(STextBlock).Text(FText::FromString(TEXT("Puntos clave"))).Font(Font(17, true)).ColorAndOpacity(Text) ];
		for (const FString& K : L.KeyPoints)
		{
			Pts->AddSlot().AutoHeight().Padding(0, 2)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 8, 0)[ Body(TEXT("•"), 15, Good) ]
				+ SHorizontalBox::Slot().FillWidth(1.f)[ Body(K) ]
			];
		}
		Col->AddSlot().AutoHeight().Padding(0, 10)[ Card(Pts) ];
	}

	// Reto rápido
	if (Question)
	{
		QuizBox = SNew(SVerticalBox);
		Col->AddSlot().AutoHeight().Padding(0, 10)[ Card(QuizBox.ToSharedRef()) ];
		RebuildQuiz();
	}

	// Botones
	TWeakPtr<SAcademiaShell> WShell = Shell;
	const FCourseModule* Mod = Module;
	const int32 Idx = LessonIndex;

	TSharedRef<SHorizontalBox> Btns = SNew(SHorizontalBox);
	if (Idx > 0)
	{
		Btns->AddSlot().AutoWidth().Padding(0, 0, 10, 0)
		[
			Button(TEXT("Lección anterior"), [WShell, Mod, Idx]()
			{
				if (TSharedPtr<SAcademiaShell> S = WShell.Pin())
				{
					S->Back();
					S->OpenLesson(*Mod, Idx - 1);
				}
			})
		];
	}
	Btns->AddSlot().AutoWidth().Padding(0, 0, 10, 0)
	[
		Button(TEXT("Marcar como vista y seguir"), [WShell, Mod, Idx]()
		{
			TSharedPtr<SAcademiaShell> S = WShell.Pin();
			if (!S.IsValid()) return;
			if (UAcademiaGameInstance* G = S->GI()) G->CompleteLesson(Mod->Lessons[Idx].Id);
			S->Back();
			if (Idx + 1 < Mod->Lessons.Num()) S->OpenLesson(*Mod, Idx + 1);
			else S->OpenExam(Mod->Exam, Mod->Title);
		}, Accent, true)
	];
	Btns->AddSlot().AutoWidth()
	[
		Button(TEXT("Volver"), [WShell]() { if (TSharedPtr<SAcademiaShell> S = WShell.Pin()) S->Back(); })
	];
	Col->AddSlot().AutoHeight().Padding(0, 14, 0, 30)[ Btns ];

	ChildSlot
	[
		SNew(SScrollBox)
		+ SScrollBox::Slot()
		.HAlign(HAlign_Center)
		.Padding(20, 16)
		[
			SNew(SBox).MaxDesiredWidth(1000.f)
			[
				Col
			]
		]
	];
}

void SLessonView::RebuildQuiz()
{
	if (!QuizBox.IsValid() || !Question) return;
	QuizBox->ClearChildren();

	QuizBox->AddSlot().AutoHeight().Padding(0, 0, 0, 6)[ Tag(TEXT("Reto rápido"), Warn) ];
	QuizBox->AddSlot().AutoHeight().Padding(0, 0, 0, 8)[ Body(Question->Q, 16) ];

	for (int32 Pos = 0; Pos < Order.Num(); ++Pos)
	{
		const int32 Orig = Order[Pos];
		const FString Label = FString::Printf(TEXT("%c.  %s"), TEXT('A') + Pos, *Question->Options[Orig]);
		QuizBox->AddSlot().AutoHeight().Padding(0, 3)
		[
			OptionButton(Label,
				[this, Orig]()
				{
					if (bAnswered) return;
					bAnswered = true;
					Chosen = Orig;
					const bool bOk = (Orig == Question->Correct);
					if (TSharedPtr<SAcademiaShell> S = Shell.Pin())
					{
						if (UAcademiaGameInstance* G = S->GI())
						{
							G->RegisterAnswer(bOk, Question->Id);
							G->Sfx(bOk ? EAcademiaSfx::Ok : EAcademiaSfx::Bad);
							if (bOk) G->AddXP(15, TEXT("por el reto rápido"));
						}
					}
					// Solo se agrega la explicación; los colores se evalúan solos cada frame
					ShowFeedback();
				},
				TAttribute<FSlateColor>::CreateLambda([this, Orig]() -> FSlateColor
				{
					if (!bAnswered) return FSlateColor(Line);
					if (Orig == Question->Correct) return FSlateColor(Good);
					if (Orig == Chosen) return FSlateColor(Bad);
					return FSlateColor(Line);
				}),
				TAttribute<bool>::CreateLambda([this]() { return !bAnswered; }))
		];
	}

	FeedbackBox = SNew(SVerticalBox);
	QuizBox->AddSlot().AutoHeight().Padding(0, 8, 0, 0)[ FeedbackBox.ToSharedRef() ];
}

void SLessonView::ShowFeedback()
{
	if (!FeedbackBox.IsValid() || !Question) return;
	FeedbackBox->ClearChildren();
	const bool bOk = (Chosen == Question->Correct);
	FString Msg = bOk ? TEXT("¡Correcto! ") : TEXT("Casi. ");
	Msg += Question->Explain;
	FeedbackBox->AddSlot().AutoHeight()[ Callout(Msg, bOk ? Good : Bad) ];
}
