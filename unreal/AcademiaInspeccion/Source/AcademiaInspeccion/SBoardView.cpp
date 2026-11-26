#include "SBoardView.h"

#include "Rendering/DrawElements.h"
#include "Styling/CoreStyle.h"
#include "Styling/SlateBrush.h"
#include "Fonts/SlateFontInfo.h"
#include "Input/Events.h"
#include "Input/Reply.h"
#include "Layout/Geometry.h"

namespace
{
	// Transformacion tablero(mm, Y arriba) -> pixeles locales (Y abajo)
	struct FBoardXform
	{
		FVector2D Origin = FVector2D::ZeroVector;
		double Scale = 1.0;
		double BoardH = 0.0;
		FVector2D ToScreen(const FVector2D& P) const
		{
			return FVector2D(Origin.X + (P.X + 2.0) * Scale, Origin.Y + (BoardH + 2.0 - P.Y) * Scale);
		}
	};

	void BoardSize(const FLoadedBoard& B, double& W, double& H)
	{
		W = B.Width; H = B.Height;
		if ((W <= 0.0 || H <= 0.0) && B.Copper.Bounds.bIsValid)
		{
			W = B.Copper.Bounds.Max.X; H = B.Copper.Bounds.Max.Y;
		}
		if (W <= 0.0) { W = 10.0; }
		if (H <= 0.0) { H = 10.0; }
	}

	FBoardXform MakeXform(const FLoadedBoard& B, const FVector2D& Size)
	{
		double W, H;
		BoardSize(B, W, H);
		FBoardXform X;
		X.BoardH = H;
		// Vista de -2..W+2 y -2..H+2 como el viewBox del JS
		X.Scale = FMath::Max(0.0001, FMath::Min(Size.X / (W + 4.0), Size.Y / (H + 4.0)));
		X.Origin = FVector2D((Size.X - (W + 4.0) * X.Scale) * 0.5, (Size.Y - (H + 4.0) * X.Scale) * 0.5);
		return X;
	}

	FLinearColor Hex(uint8 R, uint8 G, uint8 B, float A = 1.f)
	{
		FLinearColor C = FLinearColor::FromSRGBColor(FColor(R, G, B, 255));
		C.A = A;
		return C;
	}

	struct FPaintCtx
	{
		FSlateWindowElementList& List;
		const FGeometry& Geo;
		const FBoardXform& X;
		const FSlateBrush* Brush;
		int32 Layer;
	};

	void DrawBox(FPaintCtx& C, const FVector2D& TopLeft, const FVector2D& Size, const FLinearColor& Col)
	{
		FSlateDrawElement::MakeBox(C.List, C.Layer, C.Geo.ToPaintGeometry(Size, FSlateLayoutTransform(TopLeft)), C.Brush, ESlateDrawEffect::None, Col);
	}

	void DrawPoly(FPaintCtx& C, const TArray<FVector2D>& Pts, const FLinearColor& Col, float Thickness, bool bAA = true)
	{
		FSlateDrawElement::MakeLines(C.List, C.Layer, C.Geo.ToPaintGeometry(), Pts, ESlateDrawEffect::None, Col, bAA, Thickness);
	}

	void DrawSeg(FPaintCtx& C, const FVector2D& A, const FVector2D& B, const FLinearColor& Col, float Thickness, bool bAA = true)
	{
		TArray<FVector2D> Pts;
		Pts.Add(A); Pts.Add(B);
		DrawPoly(C, Pts, Col, Thickness, bAA);
	}

	// Contorno de circulo (poligono cerrado) en pixeles
	void DrawCircleOutline(FPaintCtx& C, const FVector2D& Center, float Radius, const FLinearColor& Col, float Thickness, int32 Segs = 24)
	{
		TArray<FVector2D> Pts;
		Pts.Reserve(Segs + 1);
		for (int32 I = 0; I <= Segs; ++I)
		{
			const float A = 2.f * PI * (float)I / (float)Segs;
			Pts.Add(Center + FVector2D(FMath::Cos(A), FMath::Sin(A)) * Radius);
		}
		DrawPoly(C, Pts, Col, Thickness);
	}

	// Forma rellena (rect, circulo u obround) con franjas horizontales; HW/HH semiejes en px, R radio de esquina
	void DrawFilledShape(FPaintCtx& C, const FVector2D& Center, float HW, float HH, float R, const FLinearColor& Col)
	{
		if (R <= 0.5f || HW * 2.f < 3.f || HH * 2.f < 3.f)
		{
			DrawBox(C, Center - FVector2D(HW, HH), FVector2D(HW * 2.f, HH * 2.f), Col);
			return;
		}
		const int32 Strips = FMath::Clamp(FMath::CeilToInt(HH), 2, 24);
		const float Step = (2.f * HH) / (float)Strips;
		for (int32 I = 0; I < Strips; ++I)
		{
			const float DY = -HH + Step * ((float)I + 0.5f);
			const float Over = FMath::Max(FMath::Abs(DY) - (HH - R), 0.f);
			const float Half = HW - R + FMath::Sqrt(FMath::Max(R * R - Over * Over, 0.f));
			if (Half <= 0.f) { continue; }
			DrawSeg(C, FVector2D(Center.X - Half, Center.Y + DY), FVector2D(Center.X + Half, Center.Y + DY), Col, Step + 0.6f, false);
		}
	}

	void DrawGerber(FPaintCtx& C, const FGerberLayer& G, const FLinearColor& Col)
	{
		for (const TArray<FVector2D>& Reg : G.Regions)
		{
			TArray<FVector2D> Pts;
			Pts.Reserve(Reg.Num() + 1);
			for (const FVector2D& P : Reg) { Pts.Add(C.X.ToScreen(P)); }
			if (Pts.Num() > 0) { Pts.Add(Pts[0]); }
			DrawPoly(C, Pts, Col, 1.f);
		}
		for (const FGerberFlash& F : G.Flashes)
		{
			const FVector2D S = C.X.ToScreen(F.Pos);
			const float HW = FMath::Max(0.5f, F.W * 0.5f * (float)C.X.Scale);
			const float HH = FMath::Max(0.5f, F.H * 0.5f * (float)C.X.Scale);
			float R = 0.f;
			if (F.Shape == TEXT("C")) { R = FMath::Min(HW, HH); }
			else if (F.Shape == TEXT("O")) { R = FMath::Min(HW, HH); }
			DrawFilledShape(C, S, HW, HH, R, Col);
		}
		for (const FGerberLine& L : G.Lines)
		{
			DrawSeg(C, C.X.ToScreen(L.A), C.X.ToScreen(L.B), Col, FMath::Max(1.f, L.Width * (float)C.X.Scale));
		}
	}

	bool IsSkippedRef(const FString& Ref)
	{
		return Ref.StartsWith(TEXT("FID")) || Ref.StartsWith(TEXT("TP"));
	}

	// Dimensiones del cuerpo en mm tras aplicar la rotacion de 90 grados; false si no tiene cuerpo
	bool BodyDims(const FLoadedBoard& B, const FBoardComponent& Comp, double& W, double& H)
	{
		const FBoardPackage* P = B.Packages.Find(Comp.Package);
		if (!P || P->Body.X <= 0.0) { return false; }
		W = P->Body.X; H = P->Body.Y;
		const double R = FMath::Fmod(FMath::Abs((double)Comp.Rotation), 180.0);
		if (FMath::IsNearlyEqual(R, 90.0, 1.0)) { Swap(W, H); }
		return true;
	}
}

void SBoardView::Construct(const FArguments& InArgs)
{
	Board = InArgs._Board;
	LayersAttr = InArgs._Layers;
	OnComponentClicked = InArgs._OnComponentClicked;
}

void SBoardView::SetBoard(TSharedPtr<const FLoadedBoard> InBoard)
{
	Board = InBoard;
	Invalidate(EInvalidateWidgetReason::Paint);
}

void SBoardView::SetMarkers(const TMap<FString, FLinearColor>& RefToColor)
{
	Markers = RefToColor;
	Invalidate(EInvalidateWidgetReason::Paint);
}

void SBoardView::SetHighlight(const FString& Ref)
{
	HighlightRef = Ref;
	Invalidate(EInvalidateWidgetReason::Paint);
}

FVector2D SBoardView::ComputeDesiredSize(float LayoutScaleMultiplier) const
{
	return FVector2D(600.0, 400.0);
}

int32 SBoardView::OnPaint(const FPaintArgs& Args, const FGeometry& AllottedGeometry, const FSlateRect& MyCullingRect, FSlateWindowElementList& OutDrawElements, int32 LayerId, const FWidgetStyle& InWidgetStyle, bool bParentEnabled) const
{
	if (!Board.IsValid()) { return LayerId; }
	const FLoadedBoard& B = *Board;
	const uint32 Vis = LayersAttr.Get((uint32)(EBoardLayer::Copper | EBoardLayer::Mask | EBoardLayer::Silk | EBoardLayer::Drill | EBoardLayer::Comps | EBoardLayer::TestPoints));
	const FVector2D Size = FVector2D(AllottedGeometry.GetLocalSize());
	const FBoardXform X = MakeXform(B, Size);

	FPaintCtx C{ OutDrawElements, AllottedGeometry, X, FCoreStyle::Get().GetBrush("WhiteBrush"), LayerId };
	double BW, BH;
	BoardSize(B, BW, BH);

	// Tarjeta: fondo verde y contorno dorado
	const FVector2D TL = X.ToScreen(FVector2D(0.0, BH));
	DrawBox(C, TL, FVector2D(BW * X.Scale, BH * X.Scale), Hex(0x14, 0x53, 0x2d));
	++C.Layer;

	if ((Vis & EBoardLayer::Copper) && !B.Copper.IsEmpty()) { DrawGerber(C, B.Copper, Hex(0xc9, 0xa7, 0x4a, 0.9f)); ++C.Layer; }
	if ((Vis & EBoardLayer::Mask) && !B.Mask.IsEmpty()) { DrawGerber(C, B.Mask, Hex(0x7a, 0xd6, 0x7a, 0.25f)); ++C.Layer; }
	if ((Vis & EBoardLayer::Paste) && !B.Paste.IsEmpty()) { DrawGerber(C, B.Paste, Hex(0xc0, 0xc6, 0xcc, 0.95f)); ++C.Layer; }
	if ((Vis & EBoardLayer::Silk) && !B.Silk.IsEmpty()) { DrawGerber(C, B.Silk, Hex(0xf2, 0xf2, 0xf2, 0.9f)); ++C.Layer; }

	// Contorno dorado (rectangulo y, si existe, capa Edge.Cuts)
	{
		const FLinearColor Gold = Hex(0xd9, 0xc0, 0x7a);
		TArray<FVector2D> Rect;
		Rect.Add(X.ToScreen(FVector2D(0, 0))); Rect.Add(X.ToScreen(FVector2D(BW, 0)));
		Rect.Add(X.ToScreen(FVector2D(BW, BH))); Rect.Add(X.ToScreen(FVector2D(0, BH))); Rect.Add(Rect[0]);
		DrawPoly(C, Rect, Gold, 1.5f);
		if (!B.Outline.IsEmpty()) { DrawGerber(C, B.Outline, Gold); }
		++C.Layer;
	}

	if ((Vis & EBoardLayer::Drill) && B.Holes.Num() > 0)
	{
		const FLinearColor Dark = Hex(0x0b, 0x0f, 0x13);
		const FLinearColor Ring = Hex(0x88, 0x88, 0x88);
		for (const FDrillHole& H : B.Holes)
		{
			const FVector2D S = X.ToScreen(H.Pos);
			const float R = FMath::Max(1.f, H.Diameter * 0.5f * (float)X.Scale);
			DrawFilledShape(C, S, R, R, R, Dark);
		}
		++C.Layer;
		for (const FDrillHole& H : B.Holes)
		{
			DrawCircleOutline(C, X.ToScreen(H.Pos), FMath::Max(1.f, H.Diameter * 0.5f * (float)X.Scale), Ring, 1.f, 16);
		}
		++C.Layer;
	}

	if (Vis & EBoardLayer::Comps)
	{
		for (const FBoardComponent& Comp : B.Comps)
		{
			if (IsSkippedRef(Comp.Ref)) { continue; }
			double W, H;
			if (!BodyDims(B, Comp, W, H)) { continue; }
			const FString Algo = B.AlgoOf(Comp.Package);
			const bool bDark = (Algo == TEXT("BGA") || Algo == TEXT("GW"));
			const FLinearColor Col = bDark ? Hex(0x23, 0x27, 0x2c, 0.9f) : Hex(0x7a, 0x6a, 0x55, 0.9f);
			const FVector2D S = X.ToScreen(FVector2D(Comp.Pos.X - W * 0.5, Comp.Pos.Y + H * 0.5));
			DrawBox(C, S, FVector2D(W * X.Scale, H * X.Scale), Col);
		}
		++C.Layer;
	}

	if (Vis & EBoardLayer::TestPoints)
	{
		const FLinearColor Cyan = Hex(0x22, 0xd3, 0xee);
		TSet<FString> Seen;
		const float R = 0.9f * (float)X.Scale;
		for (const FNetPoint& N : B.Nets)
		{
			if (!N.bTestPoint) { continue; }
			Seen.Add(N.Ref);
			DrawCircleOutline(C, X.ToScreen(N.Pos), R, Cyan, 2.f);
		}
		for (const FBoardComponent& Comp : B.Comps)
		{
			if (Comp.Ref.StartsWith(TEXT("TP")) && !Seen.Contains(Comp.Ref))
			{
				DrawCircleOutline(C, X.ToScreen(Comp.Pos), R, Cyan, 2.f);
			}
		}
		++C.Layer;
	}

	// Marcadores y resaltado
	auto RingFor = [&](const FBoardComponent& Comp) -> float
	{
		double W = 0, H = 0;
		float Rmm = 1.5f;
		if (BodyDims(B, Comp, W, H)) { Rmm = (float)(0.5 * FMath::Sqrt(W * W + H * H)); }
		return (Rmm + 0.8f) * (float)X.Scale;
	};
	for (const TPair<FString, FLinearColor>& KV : Markers)
	{
		if (const FBoardComponent* Comp = B.FindComp(KV.Key))
		{
			DrawCircleOutline(C, X.ToScreen(Comp->Pos), RingFor(*Comp), KV.Value, 2.5f, 28);
		}
	}
	if (!HighlightRef.IsEmpty())
	{
		if (const FBoardComponent* Comp = B.FindComp(HighlightRef))
		{
			DrawCircleOutline(C, X.ToScreen(Comp->Pos), RingFor(*Comp) + 3.f, FLinearColor::White, 3.f, 28);
		}
	}
	++C.Layer;

	// Referencias
	if (Vis & EBoardLayer::Refs)
	{
		const FSlateFontInfo Font = FCoreStyle::GetDefaultFontStyle("Regular", 7);
		for (const FBoardComponent& Comp : B.Comps)
		{
			const FVector2D S = X.ToScreen(Comp.Pos);
			const float TextW = 5.f * (float)Comp.Ref.Len();
			const FVector2D Pos(S.X - TextW * 0.5f, S.Y - 1.6f * (float)X.Scale - 10.f);
			FSlateDrawElement::MakeText(OutDrawElements, C.Layer, AllottedGeometry.ToPaintGeometry(FVector2D(TextW + 4.f, 12.f), FSlateLayoutTransform(Pos)), Comp.Ref, Font, ESlateDrawEffect::None, Hex(0xe8, 0xee, 0xf4));
		}
		++C.Layer;
	}
	return C.Layer;
}

FReply SBoardView::OnMouseButtonDown(const FGeometry& MyGeometry, const FPointerEvent& MouseEvent)
{
	if (MouseEvent.GetEffectingButton() != EKeys::LeftMouseButton || !Board.IsValid()) { return FReply::Unhandled(); }
	const FLoadedBoard& B = *Board;
	const FVector2D Size = FVector2D(MyGeometry.GetLocalSize());
	const FBoardXform X = MakeXform(B, Size);
	const FVector2D Click = FVector2D(MyGeometry.AbsoluteToLocal(MouseEvent.GetScreenSpacePosition()));

	const FBoardComponent* Best = nullptr;
	double BestArea = TNumericLimits<double>::Max();
	for (const FBoardComponent& Comp : B.Comps)
	{
		double W = 1.5, H = 1.5;
		if (!BodyDims(B, Comp, W, H)) { W = 1.5; H = 1.5; }
		// Zona minima de 10 px para poder hacer clic en piezas diminutas
		const double PW = FMath::Max(W * X.Scale, 10.0), PH = FMath::Max(H * X.Scale, 10.0);
		const FVector2D S = X.ToScreen(Comp.Pos);
		if (FMath::Abs(Click.X - S.X) <= PW * 0.5 && FMath::Abs(Click.Y - S.Y) <= PH * 0.5)
		{
			const double Area = PW * PH;
			if (Area < BestArea) { BestArea = Area; Best = &Comp; }
		}
	}
	if (Best)
	{
		OnComponentClicked.ExecuteIfBound(Best->Ref);
		return FReply::Handled();
	}
	return FReply::Unhandled();
}
