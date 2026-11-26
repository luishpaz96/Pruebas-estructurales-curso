#pragma once

// Software de inspección simulado (AOIGUI, Smart GUI, V810, HP3070/BT-Basic, CEditor/ePM-SPI).
// Port de createProgram/simulate/run de js/simui.js: Importar > Fiduciales > Librería > Umbrales > Correr lote.

#include "CoreMinimal.h"
#include "Widgets/SCompoundWidget.h"
#include "Widgets/DeclarativeSyntaxSupport.h"
#include "AcademiaGerber.h"

class SAcademiaShell;
class UAcademiaGameInstance;
class SBoardView;
class SBox;
class SScrollBox;
class SMenuAnchor;
class SEditableTextBox;
class SMultiLineEditableTextBox;

// Elemento de menú/barra de herramientas. Act: >=0 abre esa pestaña del flujo, -1 solo informa, -2 salir
struct FSwMenuItem
{
	FString Name;
	int32 Act = -1;
};

struct FSwMenu
{
	FString Name;
	TArray<FSwMenuItem> Items;
};

// Apariencia del software de cada máquina
struct FSwTheme
{
	FString WindowTitle, TreeRoot, PropTitle, AlgoLabel, ReadyText, BusyText, ConveyorName, JobExt;
	FLinearColor Bg, Panel, Panel2, Line, Text, Muted, Accent, TitleBar, TitleText;
	TArray<FSwMenu> Menus;
	TArray<FSwMenuItem> Tools;   // un nombre que empieza con "|" es una etiqueta de grupo
	int32 ActiveMenu = -1;
	bool bXray = false;
	bool bCmdLine = false;
	bool bRibbon = false;
};

struct FSwParam
{
	FString K, Name, Unit;
	float Min = 0, Max = 100, V = 0, TMin = 0, TMax = 100;
	bool bInv = false;
};

struct FSwDefect
{
	FString Name, ParamK, Algo; // Algo vacío = aplica a cualquier encapsulado
};

struct FSwModeDef
{
	FString Name, Machine;
	FLinearColor Color = FLinearColor::White;
	uint32 Layers = 0;
	TArray<TPair<FString, FString>> Algos; // clave -> nombre
	TArray<FSwParam> Params;
	TArray<FSwDefect> Defects;
};

struct FSwSimResult
{
	int32 Falses = 0, Escapes = 0, Caught = 0;
	TMap<FString, FString> NG;            // ref -> "falso" o nombre del defecto real
	TArray<TPair<FString, bool>> Rows;    // texto, esEscape
};

class ACADEMIAINSPECCION_API SMachineSoftware : public SCompoundWidget
{
public:
	SLATE_BEGIN_ARGS(SMachineSoftware) {}
		SLATE_ARGUMENT(TWeakPtr<SAcademiaShell>, Shell)
		SLATE_ARGUMENT(FString, Mode)       // aoi | spi | axi | ict
		SLATE_ARGUMENT(FString, MachineId)  // aoi_ky | aoi_v510 | spi | axi_v810 | ict
	SLATE_END_ARGS()

	void Construct(const FArguments& InArgs);

private:
	UAcademiaGameInstance* GI() const;

	// Registro (panel inferior)
	void AddLog(const FString& Msg, const FLinearColor& Color);
	void LogInfo(const FString& Msg);
	void LogOk(const FString& Msg);
	void LogWarn(const FString& Msg);
	void LogErr(const FString& Msg);

	// Widgets auxiliares con los colores del tema
	TSharedRef<SWidget> Txt(const FString& S, int32 Size, const FLinearColor& Color, bool bBold = false) const;
	TSharedRef<SWidget> Btn(const FString& Label, TFunction<void()> OnClick, bool bPrimary = false, TFunction<bool()> IsEnabled = nullptr, int32 Size = 12) const;
	TSharedRef<SWidget> ToggleBtn(const FString& Label, TFunction<void()> OnClick, TFunction<bool()> IsOn, int32 Size = 11) const;
	TSharedRef<SWidget> Group(const FString& Title, TSharedRef<SWidget> Content) const;

	TSharedRef<SWidget> BuildTitleBar();
	TSharedRef<SWidget> BuildMenuBar();
	TSharedRef<SWidget> BuildMenuContent(int32 MenuIndex);
	TSharedRef<SWidget> BuildToolBar();
	TSharedRef<SWidget> BuildTabStrip();
	TSharedRef<SWidget> BuildPropGrid();
	TSharedRef<SWidget> BuildStatusBar();
	TSharedRef<SWidget> BuildTree();
	TSharedRef<SWidget> BuildPanel();
	TSharedRef<SWidget> BuildPanelImport();
	TSharedRef<SWidget> BuildPanelFiducials();
	TSharedRef<SWidget> BuildPanelLibrary();
	TSharedRef<SWidget> BuildPanelThresholds();
	TSharedRef<SWidget> BuildPanelRun();

	void RebuildTree();
	void RebuildCenter();
	void RebuildPanel();
	void RefreshMarkers();

	void SetTab(int32 NewTab);
	void HandleAction(const FString& Name, int32 Act);
	void HandleComponentClicked(const FString& Ref);
	void HandleTreeClick(const FString& Ref);
	FString SelectionInfo() const;
	FString AlgoName(const FString& Key) const;
	TArray<FString> PackageList() const;
	int32 RequiredFids() const;

	// Carga de tarjetas
	void ApplyBoard(TSharedPtr<FLoadedBoard> NewBoard, const FString& Origin);
	void ImportDefault();
	void ImportFolder();

	// Librería y simulación (port de simulate/run)
	bool AlgoOK(const FBoardComponent& C) const;
	void VerifyLibrary();
	FSwSimResult Simulate(int32 N, int32 Seed) const;
	void UpdateEstimate();
	void StartRun();
	void FinishRun();
	EActiveTimerReturnType OnRunTimer(double InCurrentTime, float InDeltaTime);

	// ICT
	FString BuildPlanText() const;
	void RunCommand(const FString& Cmd);

	TWeakPtr<SAcademiaShell> Shell;
	FString Mode, MachineId;
	FSwTheme Theme;
	FSwModeDef Def;

	TSharedPtr<FLoadedBoard> Board;
	TSharedPtr<SBoardView> BoardView;
	TSharedPtr<SBox> CenterBox, PropsBox, TreeBox;
	TSharedPtr<SScrollBox> LogBox;
	TSharedPtr<SMultiLineEditableTextBox> PlanBox;
	TSharedPtr<SEditableTextBox> CmdBox;
	TArray<TSharedPtr<SMenuAnchor>> MenuAnchors;

	int32 Tab = 0;
	uint32 LayerMask = 0;
	TSet<FString> Fids;
	TMap<FString, FString> Lib;       // encapsulado -> clave de algoritmo
	TMap<FString, float> ParamVals;
	TMap<FString, FString> NG;
	FString SelRef;
	FString PlanText;
	FString ImportInfo;
	int32 EstF = 0, EstE = 0;
	bool bLibChecked = false;

	bool bRunning = false;
	bool bHasRun = false;
	bool bReleased = false;
	int32 RunDone = 0;
	FSwSimResult RunResult;
	TArray<FString> Tips;
};
