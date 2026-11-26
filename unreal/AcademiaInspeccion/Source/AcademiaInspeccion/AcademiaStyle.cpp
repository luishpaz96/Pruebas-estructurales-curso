#include "AcademiaStyle.h"

#include "Styling/CoreStyle.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SOverlay.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Images/SImage.h"

namespace AcademiaUI
{
	const FLinearColor Bg(0.035f, 0.045f, 0.06f, 0.94f);
	const FLinearColor Panel(0.075f, 0.09f, 0.11f, 0.96f);
	const FLinearColor Panel2(0.11f, 0.135f, 0.165f, 1.f);
	const FLinearColor Line(0.2f, 0.24f, 0.29f, 1.f);
	const FLinearColor Text(0.9f, 0.92f, 0.95f, 1.f);
	const FLinearColor Muted(0.55f, 0.6f, 0.67f, 1.f);
	const FLinearColor Accent(0.24f, 0.55f, 1.f, 1.f);
	const FLinearColor Good(0.21f, 0.82f, 0.5f, 1.f);
	const FLinearColor Warn(1.f, 0.69f, 0.13f, 1.f);
	const FLinearColor Bad(1.f, 0.35f, 0.37f, 1.f);

	FSlateFontInfo Font(int32 Size, bool bBold)
	{
		return FCoreStyle::GetDefaultFontStyle(bBold ? "Bold" : "Regular", Size);
	}

	FSlateFontInfo Mono(int32 Size)
	{
		return FCoreStyle::GetDefaultFontStyle("Mono", Size);
	}

	const FSlateBrush* White()
	{
		return FCoreStyle::Get().GetBrush("WhiteBrush");
	}

	FLinearColor Lerp(const FLinearColor& A, const FLinearColor& B, float T)
	{
		return A + (B - A) * FMath::Clamp(T, 0.f, 1.f);
	}

	TSharedRef<SWidget> Title(const FString& S, int32 Size)
	{
		return SNew(STextBlock).Text(FText::FromString(S)).Font(Font(Size, true)).ColorAndOpacity(Text).AutoWrapText(true);
	}

	TSharedRef<SWidget> Body(const FString& S, int32 Size, FLinearColor Color)
	{
		return SNew(STextBlock).Text(FText::FromString(S)).Font(Font(Size)).ColorAndOpacity(Color).AutoWrapText(true);
	}

	TSharedRef<SWidget> Tag(const FString& S, FLinearColor Color)
	{
		return SNew(SBorder)
			.BorderImage(White())
			.BorderBackgroundColor(FLinearColor(Color.R, Color.G, Color.B, 0.18f))
			.Padding(FMargin(8, 3))
			[
				SNew(STextBlock).Text(FText::FromString(S)).Font(Font(11, true)).ColorAndOpacity(Color)
			];
	}

	TSharedRef<SWidget> Card(TSharedRef<SWidget> Content, FLinearColor Color, float Pad)
	{
		return SNew(SBorder)
			.BorderImage(White())
			.BorderBackgroundColor(Line)
			.Padding(1.f)
			[
				SNew(SBorder)
				.BorderImage(White())
				.BorderBackgroundColor(Color)
				.Padding(Pad)
				[
					Content
				]
			];
	}

	TSharedRef<SWidget> Callout(const FString& S, FLinearColor Color)
	{
		return SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth()
			[
				SNew(SBox).WidthOverride(4.f)
				[
					SNew(SImage).Image(White()).ColorAndOpacity(Color)
				]
			]
			+ SHorizontalBox::Slot().FillWidth(1.f)
			[
				SNew(SBorder)
				.BorderImage(White())
				.BorderBackgroundColor(FLinearColor(Color.R, Color.G, Color.B, 0.12f))
				.Padding(FMargin(12, 8))
				[
					SNew(STextBlock).Text(FText::FromString(S)).Font(Font(14)).ColorAndOpacity(Text).AutoWrapText(true)
				]
			];
	}

	TSharedRef<SWidget> Progress(float Pct, FLinearColor Color, float Height)
	{
		Pct = FMath::Clamp(Pct, 0.f, 1.f);
		return SNew(SBox).HeightOverride(Height)
			[
				SNew(SOverlay)
				+ SOverlay::Slot()
				[
					SNew(SImage).Image(White()).ColorAndOpacity(FLinearColor(1, 1, 1, 0.08f))
				]
				+ SOverlay::Slot()
				[
					SNew(SHorizontalBox)
					+ SHorizontalBox::Slot().FillWidth(FMath::Max(Pct, 0.0001f))
					[
						SNew(SImage).Image(White()).ColorAndOpacity(Color)
					]
					+ SHorizontalBox::Slot().FillWidth(FMath::Max(1.f - Pct, 0.0001f))
					[
						SNullWidget::NullWidget
					]
				]
			];
	}

	TSharedRef<SWidget> Button(const FString& Label, TFunction<void()> OnClick, FLinearColor Color, bool bPrimary, int32 FontSize)
	{
		const FLinearColor Fill = bPrimary ? Color : FLinearColor(Color.R, Color.G, Color.B, 0.14f);
		return SNew(SButton)
			.ButtonStyle(&FCoreStyle::Get().GetWidgetStyle<FButtonStyle>("NoBorder"))
			.ContentPadding(0)
			.OnClicked_Lambda([OnClick]() { if (OnClick) OnClick(); return FReply::Handled(); })
			[
				SNew(SBorder)
				.BorderImage(White())
				.BorderBackgroundColor(Color)
				.Padding(1.f)
				[
					SNew(SBorder)
					.BorderImage(White())
					.BorderBackgroundColor(Fill)
					.Padding(FMargin(14, 7))
					.HAlign(HAlign_Center)
					[
						SNew(STextBlock)
						.Text(FText::FromString(Label))
						.Font(Font(FontSize, true))
						.ColorAndOpacity(bPrimary ? FLinearColor(0.02f, 0.03f, 0.04f) : Text)
					]
				]
			];
	}

	TSharedRef<SWidget> OptionButton(const FString& Label, TFunction<void()> OnClick, TAttribute<FSlateColor> StateColor, TAttribute<bool> bEnabled)
	{
		return SNew(SButton)
			.ButtonStyle(&FCoreStyle::Get().GetWidgetStyle<FButtonStyle>("NoBorder"))
			.ContentPadding(0)
			.IsEnabled(bEnabled)
			.OnClicked_Lambda([OnClick]() { if (OnClick) OnClick(); return FReply::Handled(); })
			[
				SNew(SBorder)
				.BorderImage(White())
				.BorderBackgroundColor(StateColor)
				.Padding(1.f)
				[
					SNew(SBorder)
					.BorderImage(White())
					.BorderBackgroundColor(Panel2)
					.Padding(FMargin(14, 10))
					[
						SNew(STextBlock).Text(FText::FromString(Label)).Font(Font(15)).ColorAndOpacity(Text).AutoWrapText(true)
					]
				]
			];
	}
}
