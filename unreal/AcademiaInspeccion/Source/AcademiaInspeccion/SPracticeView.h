#pragma once

// Práctica guiada (content/practices): bitácora de "software" a la izquierda y pasos a la derecha.

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "CourseContent.h"
#include "SAcademiaShell.h"

class SBox;
class SVerticalBox;
class SScrollBox;

class ACADEMIAINSPECCION_API SPracticeView : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SPracticeView) {}
		SLATE_ARGUMENT(TWeakPtr<SAcademiaShell>, Shell)
		SLATE_ARGUMENT(const FPractice*, Practice)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	enum class EStage : uint8 { Steps, Params, Done };

	void Log(const FString& Line, const FLinearColor& Color);
	void RebuildPanel();
	TSharedRef<SWidget> BuildStep();
	TSharedRef<SWidget> BuildParams();
	TSharedRef<SWidget> BuildDone();
	void PickOption(int32 OrigIndex);
	void NextStep();
	void ApplyParams();
	void Finish();
	void EvalParams(int32& OutF, int32& OutE) const;
	UAcademiaGameInstance* GI() const;

	TWeakPtr<SAcademiaShell> Shell;
	const FPractice* P = nullptr;

	EStage Stage = EStage::Steps;
	int32 StepIdx = 0;
	int32 Score = 0;
	int32 Mistakes = 0;
	int32 Pct = 0;
	bool bStepDone = false;
	TArray<int32> Order;        // opciones del paso actual: posición -> índice original
	TSet<int32> Disabled;       // opciones erradas del paso actual
	TArray<float> Values;       // valor actual de cada parámetro

	TSharedPtr<SBox> PanelBox;
	TSharedPtr<SVerticalBox> FeedbackBox;
	TSharedPtr<SVerticalBox> LogBox;
	TSharedPtr<SScrollBox> LogScroll;
};
