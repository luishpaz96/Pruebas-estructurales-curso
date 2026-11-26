#pragma once

// Estilo común de la interfaz (Slate puro, sin assets). Tema oscuro tipo panel industrial.

#include "CoreMinimal.h"
#include "Widgets/SWidget.h"
#include "Fonts/SlateFontInfo.h"
#include "Styling/SlateBrush.h"
#include "Input/Reply.h"

namespace AcademiaUI
{
	// Paleta
	ACADEMIAINSPECCION_API extern const FLinearColor Bg;        // fondo de paneles
	ACADEMIAINSPECCION_API extern const FLinearColor Panel;     // tarjetas
	ACADEMIAINSPECCION_API extern const FLinearColor Panel2;    // tarjetas resaltadas / hover
	ACADEMIAINSPECCION_API extern const FLinearColor Line;      // bordes
	ACADEMIAINSPECCION_API extern const FLinearColor Text;
	ACADEMIAINSPECCION_API extern const FLinearColor Muted;
	ACADEMIAINSPECCION_API extern const FLinearColor Accent;    // azul
	ACADEMIAINSPECCION_API extern const FLinearColor Good;      // verde
	ACADEMIAINSPECCION_API extern const FLinearColor Warn;      // ámbar
	ACADEMIAINSPECCION_API extern const FLinearColor Bad;       // rojo

	ACADEMIAINSPECCION_API FSlateFontInfo Font(int32 Size, bool bBold = false);
	ACADEMIAINSPECCION_API FSlateFontInfo Mono(int32 Size);
	ACADEMIAINSPECCION_API const FSlateBrush* White();   // brocha blanca para colorear con ColorAndOpacity / BorderBackgroundColor

	// Constructores de widgets frecuentes
	ACADEMIAINSPECCION_API TSharedRef<SWidget> Title(const FString& S, int32 Size = 26);
	ACADEMIAINSPECCION_API TSharedRef<SWidget> Body(const FString& S, int32 Size = 15, FLinearColor Color = FLinearColor(0.88f, 0.9f, 0.93f));
	ACADEMIAINSPECCION_API TSharedRef<SWidget> Tag(const FString& S, FLinearColor Color);
	ACADEMIAINSPECCION_API TSharedRef<SWidget> Card(TSharedRef<SWidget> Content, FLinearColor Color = FLinearColor(0.075f, 0.09f, 0.11f, 0.96f), float Pad = 14.f);
	ACADEMIAINSPECCION_API TSharedRef<SWidget> Callout(const FString& S, FLinearColor Color);   // tip / advertencia / feedback
	ACADEMIAINSPECCION_API TSharedRef<SWidget> Progress(float Pct, FLinearColor Color, float Height = 8.f);
	// Botón. bPrimary = relleno de color; si no, contorno. OnClick no necesita devolver FReply.
	ACADEMIAINSPECCION_API TSharedRef<SWidget> Button(const FString& Label, TFunction<void()> OnClick, FLinearColor Color = FLinearColor(0.24f, 0.55f, 1.f), bool bPrimary = false, int32 FontSize = 15);
	// Botón de opción grande (exámenes y prácticas). StateColor se evalúa cada frame (correcta/incorrecta).
	ACADEMIAINSPECCION_API TSharedRef<SWidget> OptionButton(const FString& Label, TFunction<void()> OnClick, TAttribute<FSlateColor> StateColor, TAttribute<bool> bEnabled);

	ACADEMIAINSPECCION_API FLinearColor Lerp(const FLinearColor& A, const FLinearColor& B, float T);
}
