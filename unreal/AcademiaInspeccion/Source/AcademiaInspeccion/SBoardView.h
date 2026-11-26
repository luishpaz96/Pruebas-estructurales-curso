#pragma once

#include "CoreMinimal.h"
#include "Widgets/SLeafWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "AcademiaGerber.h"

// Capas visibles (mascara de bits)
namespace EBoardLayer
{
enum Type : uint32
{
	Copper = 1,
	Mask = 2,
	Paste = 4,
	Silk = 8,
	Drill = 16,
	Comps = 32,
	TestPoints = 64,
	Refs = 128
};
}

DECLARE_DELEGATE_OneParam(FOnBoardComponentClicked, const FString& /*Ref*/);

// Vista 2D de una tarjeta (Gerber/centroides) ajustada al tamano del widget, con Y invertida.
class ACADEMIAINSPECCION_API SBoardView : public SLeafWidget
{
public:
	SLATE_BEGIN_ARGS(SBoardView) {}
		SLATE_ARGUMENT(TSharedPtr<const FLoadedBoard>, Board)
		SLATE_ATTRIBUTE(uint32, Layers)
		SLATE_EVENT(FOnBoardComponentClicked, OnComponentClicked)
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

	void SetBoard(TSharedPtr<const FLoadedBoard> InBoard);
	void SetMarkers(const TMap<FString, FLinearColor>& RefToColor);
	void SetHighlight(const FString& Ref);

	//~ SWidget
	virtual int32 OnPaint(const FPaintArgs& Args, const FGeometry& AllottedGeometry, const FSlateRect& MyCullingRect, FSlateWindowElementList& OutDrawElements, int32 LayerId, const FWidgetStyle& InWidgetStyle, bool bParentEnabled) const override;
	virtual FVector2D ComputeDesiredSize(float LayoutScaleMultiplier) const override;
	virtual FReply OnMouseButtonDown(const FGeometry& MyGeometry, const FPointerEvent& MouseEvent) override;

private:
	TSharedPtr<const FLoadedBoard> Board;
	TAttribute<uint32> LayersAttr;
	FOnBoardComponentClicked OnComponentClicked;
	TMap<FString, FLinearColor> Markers;
	FString HighlightRef;
};
