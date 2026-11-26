#pragma once

// Vista de una lección: bloques de texto, puntos clave y un reto rápido.

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "CourseContent.h"
#include "SAcademiaShell.h"

class SVerticalBox;

class ACADEMIAINSPECCION_API SLessonView : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SLessonView) {}
		SLATE_ARGUMENT(TWeakPtr<SAcademiaShell>, Shell)
		SLATE_ARGUMENT(const FCourseModule*, Module)
		SLATE_ARGUMENT(int32, LessonIndex)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	void RebuildQuiz();
	void ShowFeedback();

	TWeakPtr<SAcademiaShell> Shell;
	const FCourseModule* Module = nullptr;
	int32 LessonIndex = 0;

	// Reto rápido
	const FExamQuestion* Question = nullptr;
	TArray<int32> Order;       // orden mostrado -> índice original
	int32 Chosen = -1;         // índice original elegido
	bool bAnswered = false;
	TSharedPtr<SVerticalBox> QuizBox;
	TSharedPtr<SVerticalBox> FeedbackBox;
};
