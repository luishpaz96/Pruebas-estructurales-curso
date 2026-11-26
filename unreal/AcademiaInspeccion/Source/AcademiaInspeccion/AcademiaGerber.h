#pragma once

#include "CoreMinimal.h"

// Lector de archivos de manufactura (Gerber RS-274X, Excellon, centroides CSV, IPC-D-356).
// Coordenadas en mm, origen abajo-izquierda, Y hacia arriba (como en los archivos).

struct FGerberFlash
{
	FVector2D Pos = FVector2D::ZeroVector;
	FString Shape; // C, R, O o nombre de macro
	float W = 0.f;
	float H = 0.f;
};

struct FGerberLine
{
	FVector2D A = FVector2D::ZeroVector;
	FVector2D B = FVector2D::ZeroVector;
	float Width = 0.15f;
};

struct FGerberLayer
{
	TArray<FGerberFlash> Flashes;
	TArray<FGerberLine> Lines;
	TArray<TArray<FVector2D>> Regions;
	FBox2D Bounds = FBox2D(ForceInit);
	bool bInches = false;
	TArray<FString> Errors;

	bool IsEmpty() const { return Flashes.Num() == 0 && Lines.Num() == 0 && Regions.Num() == 0; }
};

struct FDrillHole
{
	FVector2D Pos = FVector2D::ZeroVector;
	float Diameter = 0.8f;
};

struct FBoardComponent
{
	FString Ref, Value, Package, Layer;
	FVector2D Pos = FVector2D::ZeroVector;
	float Rotation = 0.f;
};

struct FNetPoint
{
	FString Net, Ref, Pin;
	FVector2D Pos = FVector2D::ZeroVector;
	bool bTestPoint = false;
};

struct FBoardPackage
{
	FString Algo;
	float Height = 0.f;
	FVector2D Body = FVector2D::ZeroVector;
};

struct ACADEMIAINSPECCION_API FLoadedBoard
{
	FString Id, Name, Description;
	float Width = 0.f, Height = 0.f, Thickness = 1.6f;
	FGerberLayer Copper, Mask, Paste, Silk, Outline;
	TArray<FDrillHole> Holes;
	TArray<FBoardComponent> Comps;
	TArray<FNetPoint> Nets;
	TMap<FString, FBoardPackage> Packages;
	TArray<FString> Warnings;

	const FBoardComponent* FindComp(const FString& Ref) const;
	FString AlgoOf(const FString& Package) const; // "CR" por defecto
};

namespace AcademiaGerber
{
	ACADEMIAINSPECCION_API FGerberLayer ParseGerber(const FString& Text);
	ACADEMIAINSPECCION_API TArray<FDrillHole> ParseExcellon(const FString& Text);
	// Devuelve todas las filas, INCLUYENDO el encabezado como fila 0.
	ACADEMIAINSPECCION_API TArray<TArray<FString>> ParseCSV(const FString& Text);
	ACADEMIAINSPECCION_API TArray<FBoardComponent> ParseCentroid(const FString& Text); // encabezados tolerantes como en el JS
	ACADEMIAINSPECCION_API TArray<FNetPoint> ParseIPC356(const FString& Text);
	// Carga <BoardDir>/board.json y los archivos que referencia; los faltantes van a Warnings, nunca falla duro.
	ACADEMIAINSPECCION_API bool LoadBoardFromDir(const FString& BoardDir, FLoadedBoard& Out);
	// Construye una tarjeta desde archivos sueltos por extension/nombre, como importFiles de simui.js.
	ACADEMIAINSPECCION_API bool LoadBoardFromFiles(const TArray<FString>& FilePaths, FLoadedBoard& Out);
}
