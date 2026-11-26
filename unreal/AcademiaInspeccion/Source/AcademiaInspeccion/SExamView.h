#pragma once

// Examen de una pregunta a la vez, con temporizador opcional, resultados y revisión.

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "CourseContent.h"
#include "SAcademiaShell.h"

class SBox;
class SVerticalBox;

class ACADEMIAINSPECCION_API SExamView : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SExamView) : _bPractice(false) {}
		SLATE_ARGUMENT(TWeakPtr<SAcademiaShell>, Shell)
		SLATE_ARGUMENT(FCourseExam, Exam)
		SLATE_ARGUMENT(FString, Title)
		SLATE_ARGUMENT(bool, bPractice)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);
	virtual void Tick(const FGeometry& AllottedGeometry, const double InCurrentTime, const float InDeltaTime) override;

private:
	enum class EPhase : uint8 { Intro, Question, Result };

	void Reset();
	void Rebuild();
	TSharedRef<SWidget> BuildIntro();
	TSharedRef<SWidget> BuildQuestion();
	TSharedRef<SWidget> BuildResult();
	void Start();
	void Choose(int32 OrigIndex);      // OrigIndex = -1 si se acabó el tiempo
	void ShowFeedback();
	void Next();
	void Finish();
	bool UseTimer() const;
	UAcademiaGameInstance* GI() const;

	TWeakPtr<SAcademiaShell> Shell;
	FCourseExam Exam;
	FString Title;
	bool bPractice = false;

	EPhase Phase = EPhase::Intro;
	int32 Cur = 0;
	bool bLocked = false;
	bool bTimed = false;
	float TimeLeft = 60.f;
	int32 Correct = 0;
	int32 Pct = 0;
	TArray<TArray<int32>> Orders;   // por pregunta: posición mostrada -> índice original
	TArray<int32> Answers;          // índice original elegido; -1 sin responder

	TSharedPtr<SBox> ContentBox;
	TSharedPtr<SVerticalBox> FeedbackBox;
};
