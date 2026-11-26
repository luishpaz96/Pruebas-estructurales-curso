#include "SMachineSoftware.h"

#include "SAcademiaShell.h"
#include "AcademiaGameInstance.h"
#include "AcademiaStyle.h"
#include "SBoardView.h"
#include "CourseContent.h"
#include "AcademiaGerber.h"

#include "HAL/FileManager.h"
#include "Misc/Paths.h"
#include "Misc/DateTime.h"
#include "Styling/CoreStyle.h"
#include "Widgets/SBoxPanel.h"
#include "Widgets/SOverlay.h"
#include "Widgets/Layout/SBox.h"
#include "Widgets/Layout/SBorder.h"
#include "Widgets/Layout/SScrollBox.h"
#include "Widgets/Layout/SMenuAnchor.h"
#include "Widgets/Layout/SUniformGridPanel.h"
#include "Widgets/Text/STextBlock.h"
#include "Widgets/Input/SButton.h"
#include "Widgets/Input/SCheckBox.h"
#include "Widgets/Input/SSlider.h"
#include "Widgets/Input/SEditableTextBox.h"
#include "Widgets/Input/SMultiLineEditableTextBox.h"
#include "Widgets/Notifications/SProgressBar.h"

#define LOCTEXT_NAMESPACE "SMachineSoftware"

// ------------------------------------------------------------------------------------------------
// Datos estáticos: tabla MODES de simui.js, temas y menús
// ------------------------------------------------------------------------------------------------
namespace
{
	FText Tx(const FString& S) { return FText::FromString(S); }

	FSwMenuItem MI(const TCHAR* N, int32 A = -1) { FSwMenuItem I; I.Name = N; I.Act = A; return I; }
	FSwMenu MN(const TCHAR* N, std::initializer_list<FSwMenuItem> Items)
	{
		FSwMenu M; M.Name = N; M.Items = TArray<FSwMenuItem>(Items); return M;
	}

	FSwParam MakeParam(const TCHAR* K, const TCHAR* Name, const TCHAR* Unit, float Min, float Max, float V, float TMin, float TMax, bool bInv = false)
	{
		FSwParam P; P.K = K; P.Name = Name; P.Unit = Unit; P.Min = Min; P.Max = Max; P.V = V; P.TMin = TMin; P.TMax = TMax; P.bInv = bInv;
		return P;
	}
	FSwDefect MakeDefect(const TCHAR* Name, const TCHAR* ParamK, const TCHAR* Algo = TEXT(""))
	{
		FSwDefect D; D.Name = Name; D.ParamK = ParamK; D.Algo = Algo; return D;
	}
	void AddAlgos(FSwModeDef& D, const TCHAR* CR, const TCHAR* POL, const TCHAR* GW, const TCHAR* BGA, const TCHAR* PTH, const TCHAR* FID)
	{
		D.Algos.Add(TPair<FString, FString>(TEXT("CR"), CR));
		D.Algos.Add(TPair<FString, FString>(TEXT("POL"), POL));
		D.Algos.Add(TPair<FString, FString>(TEXT("GW"), GW));
		D.Algos.Add(TPair<FString, FString>(TEXT("BGA"), BGA));
		D.Algos.Add(TPair<FString, FString>(TEXT("PTH"), PTH));
		D.Algos.Add(TPair<FString, FString>(TEXT("FID"), FID));
	}

	// Equivale a MODES[mode] del JS
	FSwModeDef MakeModeDef(const FString& Mode)
	{
		FSwModeDef D;
		const uint32 Cu = EBoardLayer::Copper, Si = EBoardLayer::Silk, Co = EBoardLayer::Comps, Pa = EBoardLayer::Paste, Tp = EBoardLayer::TestPoints;
		if (Mode == TEXT("spi"))
		{
			D.Name = TEXT("SPI 3D"); D.Machine = TEXT("spi"); D.Color = FLinearColor(0.65f, 0.48f, 1.f); D.Layers = Pa | Cu;
			AddAlgos(D, TEXT("Depósito chip"), TEXT("Depósito chip"), TEXT("Depósito fino (pitch fino)"), TEXT("Depósito BGA (círculo)"), TEXT("Sin pasta"), TEXT("Fiducial"));
			D.Params.Add(MakeParam(TEXT("vmin"), TEXT("Volumen mínimo"), TEXT("%"), 20, 95, 85, 55, 70, true));
			D.Params.Add(MakeParam(TEXT("vmax"), TEXT("Volumen máximo"), TEXT("%"), 110, 250, 220, 140, 165));
			D.Params.Add(MakeParam(TEXT("off"), TEXT("Desplazamiento máximo"), TEXT("%"), 5, 80, 12, 25, 40));
			D.Defects.Add(MakeDefect(TEXT("Pasta insuficiente"), TEXT("vmin")));
			D.Defects.Add(MakeDefect(TEXT("Exceso de pasta"), TEXT("vmax")));
			D.Defects.Add(MakeDefect(TEXT("Puente de pasta"), TEXT("vmax"), TEXT("GW")));
			D.Defects.Add(MakeDefect(TEXT("Depósito desplazado"), TEXT("off")));
		}
		else if (Mode == TEXT("axi"))
		{
			D.Name = TEXT("AXI 3D"); D.Machine = TEXT("axi_v810"); D.Color = FLinearColor(1.f, 0.69f, 0.13f); D.Layers = Cu | Co;
			AddAlgos(D, TEXT("Chip (filete)"), TEXT("Chip polarizado"), TEXT("Gullwing (talón)"), TEXT("Grid array (corte de bola)"), TEXT("PTH (llenado de barril)"), TEXT("Fiducial"));
			D.Params.Add(MakeParam(TEXT("dia"), TEXT("Diámetro mínimo de bola"), TEXT("%"), 40, 98, 95, 72, 82, true));
			D.Params.Add(MakeParam(TEXT("void"), TEXT("Void máximo"), TEXT("%"), 5, 60, 55, 22, 30));
			D.Params.Add(MakeParam(TEXT("fill"), TEXT("Llenado mínimo de barril PTH"), TEXT("%"), 20, 100, 30, 70, 80, true));
			D.Defects.Add(MakeDefect(TEXT("Puente en BGA"), TEXT("dia"), TEXT("BGA")));
			D.Defects.Add(MakeDefect(TEXT("Void excesivo"), TEXT("void"), TEXT("BGA")));
			D.Defects.Add(MakeDefect(TEXT("Head-in-pillow"), TEXT("dia"), TEXT("BGA")));
			D.Defects.Add(MakeDefect(TEXT("Barril PTH incompleto"), TEXT("fill"), TEXT("PTH")));
			D.Defects.Add(MakeDefect(TEXT("Talón insuficiente"), TEXT("dia"), TEXT("GW")));
		}
		else if (Mode == TEXT("ict"))
		{
			D.Name = TEXT("ICT"); D.Machine = TEXT("ict"); D.Color = FLinearColor(1.f, 0.35f, 0.37f); D.Layers = Cu | Si | Tp;
			AddAlgos(D, TEXT("Resistor / capacitor"), TEXT("Diodo / cap. polarizado"), TEXT("Pines / TestJet"), TEXT("Boundary scan"), TEXT("Contacto / continuidad"), TEXT("Sin prueba"));
			D.Params.Add(MakeParam(TEXT("tol"), TEXT("Tolerancia de medición"), TEXT("%"), 1, 40, 2, 8, 12));
			D.Params.Add(MakeParam(TEXT("short"), TEXT("Umbral de cortos"), TEXT("Ω"), 1, 60, 55, 8, 15));
			D.Defects.Add(MakeDefect(TEXT("Valor incorrecto"), TEXT("tol"), TEXT("CR")));
			D.Defects.Add(MakeDefect(TEXT("Abierto"), TEXT("tol")));
			D.Defects.Add(MakeDefect(TEXT("Corto entre nodos"), TEXT("short")));
			D.Defects.Add(MakeDefect(TEXT("Diodo invertido"), TEXT("tol"), TEXT("POL")));
		}
		else
		{
			D.Name = TEXT("AOI 3D"); D.Machine = TEXT("aoi_ky"); D.Color = FLinearColor(0.24f, 0.55f, 1.f); D.Layers = Cu | Si | Co;
			AddAlgos(D, TEXT("Chip (R/C)"), TEXT("Polarizado"), TEXT("Gullwing (QFP/SOIC/SOT)"), TEXT("Cuerpo BGA (sólo presencia)"), TEXT("PTH / conector"), TEXT("Fiducial"));
			D.Params.Add(MakeParam(TEXT("off"), TEXT("Tolerancia de desplazamiento"), TEXT("%"), 5, 80, 15, 30, 42));
			D.Params.Add(MakeParam(TEXT("hgt"), TEXT("Umbral de altura / tombstone"), TEXT("%"), 5, 80, 70, 30, 45));
			D.Params.Add(MakeParam(TEXT("pol"), TEXT("Score mínimo de polaridad"), TEXT(""), 10, 95, 30, 55, 70, true));
			D.Defects.Add(MakeDefect(TEXT("Faltante"), TEXT("hgt")));
			D.Defects.Add(MakeDefect(TEXT("Desplazado"), TEXT("off")));
			D.Defects.Add(MakeDefect(TEXT("Polaridad invertida"), TEXT("pol"), TEXT("POL")));
			D.Defects.Add(MakeDefect(TEXT("Tombstone"), TEXT("hgt"), TEXT("CR")));
			D.Defects.Add(MakeDefect(TEXT("Puente"), TEXT("off"), TEXT("GW")));
			D.Defects.Add(MakeDefect(TEXT("Terminal levantada"), TEXT("hgt"), TEXT("GW")));
		}
		return D;
	}

	// Temas. Los nombres de menús salen de los manuales (ver reporte); los marcados como "genérico" no.
	FSwTheme MakeTheme(const FString& MachineId, const FString& Mode)
	{
		FSwTheme T;
		const bool bV510 = MachineId == TEXT("aoi_v510");
		if (Mode == TEXT("ict") || MachineId == TEXT("ict"))
		{
			// Keysight i3070 / HP3070: estación de trabajo con editor de testplan
			T.WindowTitle = TEXT("Keysight i3070 Board Test - Workstation (BT-Basic)");
			T.TreeRoot = TEXT("Testplan"); T.PropTitle = TEXT("Dispositivo / Test"); T.AlgoLabel = TEXT("Tipo de prueba");
			T.ReadyText = TEXT("Testhead: Ready"); T.BusyText = TEXT("Testing..."); T.ConveyorName = TEXT("Fixture"); T.JobExt = TEXT(".tp");
			T.Bg = FLinearColor(0.012f, 0.02f, 0.02f); T.Panel = FLinearColor(0.03f, 0.05f, 0.045f); T.Panel2 = FLinearColor(0.07f, 0.12f, 0.10f);
			T.Line = FLinearColor(0.12f, 0.24f, 0.18f); T.Text = FLinearColor(0.55f, 0.95f, 0.65f); T.Muted = FLinearColor(0.30f, 0.55f, 0.40f);
			T.Accent = FLinearColor(0.95f, 0.72f, 0.15f); T.TitleBar = FLinearColor(0.03f, 0.10f, 0.08f); T.TitleText = FLinearColor(0.75f, 1.f, 0.8f);
			T.bCmdLine = true;
			T.Menus = {
				MN(TEXT("File"), { MI(TEXT("Load Board"), 0), MI(TEXT("Save Testplan")), MI(TEXT("Exit"), -2) }),
				MN(TEXT("Edit"), { MI(TEXT("Undo")), MI(TEXT("Find")) }),
				MN(TEXT("Testplan"), { MI(TEXT("Shorts"), 3), MI(TEXT("Analog"), 3), MI(TEXT("Boundary Scan"), 2), MI(TEXT("Library"), 2) }),
				MN(TEXT("Debug"), { MI(TEXT("Debug Test"), 4), MI(TEXT("Single Step")), MI(TEXT("Fixture Info")) }),
				MN(TEXT("Run"), { MI(TEXT("Run Board"), 4), MI(TEXT("Run Production"), 4) }),
				MN(TEXT("Help"), { MI(TEXT("BT-Basic Reference")) }),
			};
			T.Tools = { MI(TEXT("Load Board"), 0), MI(TEXT("Fixture"), 1), MI(TEXT("Testplan"), 2), MI(TEXT("Debug"), 4), MI(TEXT("Run"), 4) };
		}
		else if (Mode == TEXT("spi"))
		{
			// Koh Young SPI: CEditor (Job 2.0) / ePM-SPI
			T.WindowTitle = TEXT("CEditor - ePM-SPI - Koh Young");
			T.TreeRoot = TEXT("Condition Tree"); T.PropTitle = TEXT("Pad information / Inspecting condition"); T.AlgoLabel = TEXT("Library");
			T.ReadyText = TEXT("Ready"); T.BusyText = TEXT("Inspecting..."); T.ConveyorName = TEXT("Conveyor"); T.JobExt = TEXT(".mdb");
			T.Bg = FLinearColor(0.05f, 0.045f, 0.075f); T.Panel = FLinearColor(0.085f, 0.075f, 0.12f); T.Panel2 = FLinearColor(0.14f, 0.12f, 0.2f);
			T.Line = FLinearColor(0.22f, 0.19f, 0.32f); T.Text = FLinearColor(0.88f, 0.87f, 0.95f); T.Muted = FLinearColor(0.55f, 0.52f, 0.68f);
			T.Accent = FLinearColor(0.65f, 0.48f, 1.f); T.TitleBar = FLinearColor(0.03f, 0.025f, 0.05f); T.TitleText = FLinearColor::White;
			T.Menus = {
				MN(TEXT("File"), { MI(TEXT("Load Pad file"), 0), MI(TEXT("Load Job File"), 0), MI(TEXT("Save Job File")), MI(TEXT("Save Job File AS")), MI(TEXT("Load CAD File"), 0), MI(TEXT("Import CAD File"), 0), MI(TEXT("Export Report")), MI(TEXT("User Change")), MI(TEXT("Quit"), -2) }),
				MN(TEXT("Tools"), { MI(TEXT("PCB Info")), MI(TEXT("Pads Shift")), MI(TEXT("CAD Rotation")), MI(TEXT("CAD Mirror X")), MI(TEXT("CAD Mirror Y")), MI(TEXT("Add PAD")), MI(TEXT("Edit PAD")), MI(TEXT("Library Editor"), 2), MI(TEXT("Size Library Edit"), 2), MI(TEXT("Master Library Edit"), 2) }),
				MN(TEXT("Teaching"), { MI(TEXT("Fiducial Mark"), 1), MI(TEXT("Inspecting condition"), 3) }),
				MN(TEXT("Inspection"), { MI(TEXT("Run"), 4), MI(TEXT("Stop")), MI(TEXT("Statistics")) }),
				MN(TEXT("Help"), { MI(TEXT("ePM-SPI manual")) }),
			};
			T.Tools = { MI(TEXT("Load CAD File"), 0), MI(TEXT("Fiducial Mark"), 1), MI(TEXT("Library Editor"), 2), MI(TEXT("Inspecting condition"), 3), MI(TEXT("Run"), 4) };
		}
		else if (Mode == TEXT("axi") || MachineId == TEXT("axi_v810"))
		{
			// ViTrox V810: entornos Main / Recipe / Production / Options / Services / Virtual Live
			T.WindowTitle = TEXT("ViTrox V810 - Recipe Environment (Test Development)");
			T.TreeRoot = TEXT("Recipe"); T.PropTitle = TEXT("Joint Type / Subtype"); T.AlgoLabel = TEXT("Joint Type");
			T.ReadyText = TEXT("System Ready"); T.BusyText = TEXT("Production: inspecting"); T.ConveyorName = TEXT("Loader"); T.JobExt = TEXT(".recipe");
			T.Bg = FLinearColor(0.08f, 0.09f, 0.11f); T.Panel = FLinearColor(0.12f, 0.135f, 0.16f); T.Panel2 = FLinearColor(0.18f, 0.2f, 0.24f);
			T.Line = FLinearColor(0.26f, 0.28f, 0.33f); T.Text = FLinearColor(0.9f, 0.91f, 0.93f); T.Muted = FLinearColor(0.58f, 0.6f, 0.66f);
			T.Accent = FLinearColor(1.f, 0.69f, 0.13f); T.TitleBar = FLinearColor(0.04f, 0.05f, 0.065f); T.TitleText = FLinearColor::White;
			T.bXray = true; T.ActiveMenu = 1;
			T.Menus = {
				MN(TEXT("Main"), { MI(TEXT("Recipe Table")), MI(TEXT("Defect Packager On/Off")) }),
				MN(TEXT("Recipe"), { MI(TEXT("Panel Setup")), MI(TEXT("Alignment Setup"), 1), MI(TEXT("Adjust CAD"), 0), MI(TEXT("Edit Land Patterns"), 2), MI(TEXT("Modify Subtypes"), 2), MI(TEXT("Thresholds"), 3) }),
				MN(TEXT("Production"), { MI(TEXT("Start Production"), 4), MI(TEXT("Bypass mode")) }),
				MN(TEXT("Options"), { MI(TEXT("Software Options")), MI(TEXT("Production Options")), MI(TEXT("Results Processing")) }),
				MN(TEXT("Services"), { MI(TEXT("Calibration")), MI(TEXT("X-Ray Warm-up")) }),
				MN(TEXT("Virtual Live"), { MI(TEXT("Review Images")) }),
			};
			T.Tools = { MI(TEXT("Adjust CAD"), 0), MI(TEXT("Run Alignment"), 1), MI(TEXT("|Joint Types")), MI(TEXT("Grid Array"), 2), MI(TEXT("Gullwing"), 2), MI(TEXT("Chip"), 2), MI(TEXT("PTH"), 2), MI(TEXT("|")), MI(TEXT("Start Production"), 4) };
		}
		else if (bV510)
		{
			// ViTrox V510 "Smart GUI": cinta de opciones, tema claro con acento verde azulado
			T.WindowTitle = TEXT("Smart GUI - ViTrox V510");
			T.TreeRoot = TEXT("Recipe"); T.PropTitle = TEXT("Component / Algorithm"); T.AlgoLabel = TEXT("Algorithm");
			T.ReadyText = TEXT("Ready"); T.BusyText = TEXT("Inspecting..."); T.ConveyorName = TEXT("Conveyor"); T.JobExt = TEXT(".recipe");
			T.Bg = FLinearColor(0.60f, 0.62f, 0.64f); T.Panel = FLinearColor(0.78f, 0.80f, 0.82f); T.Panel2 = FLinearColor(0.50f, 0.53f, 0.56f);
			T.Line = FLinearColor(0.34f, 0.37f, 0.40f); T.Text = FLinearColor(0.02f, 0.03f, 0.04f); T.Muted = FLinearColor(0.12f, 0.16f, 0.19f);
			T.Accent = FLinearColor(0.f, 0.42f, 0.40f); T.TitleBar = FLinearColor(0.f, 0.20f, 0.20f); T.TitleText = FLinearColor::White;
			T.bRibbon = true; T.ActiveMenu = 1;
			T.Menus = {
				MN(TEXT("Home"), { MI(TEXT("Open Recipe"), 0), MI(TEXT("Save Recipe")), MI(TEXT("Exit"), -2) }),
				MN(TEXT("Recipe"), { MI(TEXT("Import CAD"), 0), MI(TEXT("Fiducial Editor"), 1), MI(TEXT("Grayscale Editor")), MI(TEXT("Steps to Train Component"), 2) }),
				MN(TEXT("Algorithm"), { MI(TEXT("Component Locator"), 2), MI(TEXT("Body Presence"), 2), MI(TEXT("Joint"), 2), MI(TEXT("Bridge"), 2), MI(TEXT("Polarity"), 2), MI(TEXT("OCV"), 2) }),
				MN(TEXT("Inspection"), { MI(TEXT("Run"), 4), MI(TEXT("Stop")) }),
				MN(TEXT("Tools"), { MI(TEXT("Thresholds"), 3), MI(TEXT("Warpage")) }),
			};
			T.Tools = { MI(TEXT("|CAD")), MI(TEXT("Import CAD"), 0), MI(TEXT("Fiducial Editor"), 1), MI(TEXT("|Algorithm")), MI(TEXT("Library"), 2), MI(TEXT("Thresholds"), 3), MI(TEXT("|Inspection")), MI(TEXT("Run"), 4) };
		}
		else
		{
			// Koh Young Zenith: AOIGUI 2.7.3
			T.WindowTitle = TEXT("AOIGUI 2.7.3 - Koh Young");
			T.TreeRoot = TEXT("Job"); T.PropTitle = TEXT("Package / ROI"); T.AlgoLabel = TEXT("Library");
			T.ReadyText = TEXT("Machine Ready"); T.BusyText = TEXT("Inspecting..."); T.ConveyorName = TEXT("Conveyor"); T.JobExt = TEXT(".job");
			T.Bg = FLinearColor(0.045f, 0.05f, 0.06f); T.Panel = FLinearColor(0.075f, 0.082f, 0.1f); T.Panel2 = FLinearColor(0.13f, 0.145f, 0.18f);
			T.Line = FLinearColor(0.2f, 0.22f, 0.28f); T.Text = FLinearColor(0.86f, 0.89f, 0.93f); T.Muted = FLinearColor(0.5f, 0.55f, 0.63f);
			T.Accent = FLinearColor(0.12f, 0.5f, 0.95f); T.TitleBar = FLinearColor(0.02f, 0.025f, 0.035f); T.TitleText = FLinearColor::White;
			T.Menus = {
				MN(TEXT("File"), { MI(TEXT("Open"), 0), MI(TEXT("Recent Files"), 0), MI(TEXT("Save")), MI(TEXT("Exit"), -2) }),
				MN(TEXT("Edit"), { MI(TEXT("Undo")), MI(TEXT("Redo")), MI(TEXT("Delete")), MI(TEXT("Rotate")) }),
				MN(TEXT("View"), { MI(TEXT("Board View")), MI(TEXT("Conveyor")), MI(TEXT("Scatter")), MI(TEXT("Fiducial"), 1) }),
				MN(TEXT("Teaching"), { MI(TEXT("Fiducial"), 1), MI(TEXT("Pad Referencing")), MI(TEXT("Bad Mark")), MI(TEXT("CAM Barcode")), MI(TEXT("Library Manager"), 2), MI(TEXT("Ins. Cond"), 3) }),
				MN(TEXT("Inspection"), { MI(TEXT("Run"), 4), MI(TEXT("Stop")), MI(TEXT("By-Pass")), MI(TEXT("Reset")), MI(TEXT("PCB Count")), MI(TEXT("Statistics")) }),
				MN(TEXT("Tools"), { MI(TEXT("CRD Import"), 0), MI(TEXT("Jog")), MI(TEXT("Vision")), MI(TEXT("Light")), MI(TEXT("User Settings")) }),
				MN(TEXT("Help"), { MI(TEXT("ePM-AOI manual")), MI(TEXT("About AOIGUI 2.7.3")) }),
			};
			T.Tools = { MI(TEXT("Open"), 0), MI(TEXT("Save")), MI(TEXT("Grab")), MI(TEXT("PCB In/Out")), MI(TEXT("Work In")), MI(TEXT("Work Out")), MI(TEXT("PCB Lock")), MI(TEXT("Jog")), MI(TEXT("Vision")), MI(TEXT("Light")), MI(TEXT("|")), MI(TEXT("Run"), 4), MI(TEXT("Stop")), MI(TEXT("By-Pass")), MI(TEXT("Reset")) };
		}
		return T;
	}

	const TCHAR* LayerName(uint32 L)
	{
		switch (L)
		{
		case EBoardLayer::Copper: return TEXT("Cobre");
		case EBoardLayer::Mask: return TEXT("Máscara");
		case EBoardLayer::Paste: return TEXT("Pasta");
		case EBoardLayer::Silk: return TEXT("Serigrafía");
		case EBoardLayer::Drill: return TEXT("Barrenos");
		case EBoardLayer::Comps: return TEXT("Componentes");
		case EBoardLayer::TestPoints: return TEXT("Test points");
		default: return TEXT("Referencias");
		}
	}

	// Generador pseudoaleatorio con semilla: idéntico al de simui.js (s = s*16807 % 2147483647)
	struct FSwRng
	{
		int64 S = 1;
		double Next() { S = (S * 16807) % 2147483647; return (double)S / 2147483647.0; }
		double Gauss()
		{
			const double A = Next();
			const double B = Next();
			return FMath::Sqrt(-2.0 * FMath::Loge(A + 1e-9)) * FMath::Cos(2.0 * PI * B);
		}
	};

	bool IsFidOrTp(const FString& Ref) { return Ref.StartsWith(TEXT("FID")) || Ref.StartsWith(TEXT("TP")); }

	// Valor de componente a notación BT-Basic: "10k", "4.7k", "100R" -> "100", "100nF" -> "100n", "47uF 16V" -> "47u"
	FString PlanValue(const FString& Value, bool bResistor)
	{
		FString V = Value.TrimStartAndEnd();
		int32 Sp; if (V.FindChar(TEXT(' '), Sp)) { V = V.Left(Sp); }
		if (bResistor) { V.ReplaceInline(TEXT("R"), TEXT("")); if (V.IsEmpty()) V = TEXT("0"); }
		else { if (V.EndsWith(TEXT("F"))) V.LeftChopInline(1); }
		return V;
	}
}

// ------------------------------------------------------------------------------------------------
// Construcción
// ------------------------------------------------------------------------------------------------
UAcademiaGameInstance* SMachineSoftware::GI() const
{
	const TSharedPtr<SAcademiaShell> S = Shell.Pin();
	return S.IsValid() ? S->GI() : nullptr;
}

void SMachineSoftware::Construct(const FArguments& InArgs)
{
	Shell = InArgs._Shell;
	MachineId = InArgs._MachineId;
	Mode = InArgs._Mode.ToLower();
	if (Mode.IsEmpty()) { Mode = FCourseContent::SoftwareModeFor(MachineId); }
	if (MachineId.IsEmpty()) { MachineId = MakeModeDef(Mode).Machine; }

	Def = MakeModeDef(Mode);
	Theme = MakeTheme(MachineId, Mode);
	LayerMask = Def.Layers;
	for (const FSwParam& P : Def.Params) { ParamVals.Add(P.K, P.V); }
	MenuAnchors.SetNum(Theme.Menus.Num());

	const FString JobName = TEXT("PRACTICA01_") + Mode.ToUpper();

	SAssignNew(TreeBox, SBox);
	SAssignNew(CenterBox, SBox);
	SAssignNew(PropsBox, SBox);
	SAssignNew(LogBox, SScrollBox);

	TSharedRef<SWidget> CmdRow = SNullWidget::NullWidget;
	if (Theme.bCmdLine)
	{
		CmdRow = SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Panel).Padding(FMargin(6, 3))
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().AutoWidth().VAlign(VAlign_Center).Padding(0, 0, 6, 0)
			[ Txt(TEXT("BT-Basic>"), 12, Theme.Accent, true) ]
			+ SHorizontalBox::Slot().FillWidth(1.f)
			[
				SAssignNew(CmdBox, SEditableTextBox)
				.Font(AcademiaUI::Mono(12))
				.HintText(Tx(TEXT("load board | run | debug | help")))
				.OnTextCommitted_Lambda([this](const FText& T, ETextCommit::Type Type)
				{
					if (Type == ETextCommit::OnEnter)
					{
						RunCommand(T.ToString());
						if (CmdBox.IsValid()) { CmdBox->SetText(FText::GetEmpty()); }
					}
				})
			]
		];
	}

	ChildSlot
	[
		SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Bg).Padding(0)
		[
			SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight() [ BuildTitleBar() ]
			+ SVerticalBox::Slot().AutoHeight() [ BuildMenuBar() ]
			+ SVerticalBox::Slot().AutoHeight() [ BuildToolBar() ]
			+ SVerticalBox::Slot().AutoHeight() [ BuildTabStrip() ]
			+ SVerticalBox::Slot().FillHeight(1.f)
			[
				SNew(SHorizontalBox)
				+ SHorizontalBox::Slot().AutoWidth()
				[
					SNew(SBox).WidthOverride(230.f)
					[
						SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Panel).Padding(4)
						[ TreeBox.ToSharedRef() ]
					]
				]
				+ SHorizontalBox::Slot().FillWidth(1.f).Padding(2, 0)
				[
					SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(FLinearColor(0.01f, 0.012f, 0.015f)).Padding(2)
					[ CenterBox.ToSharedRef() ]
				]
				+ SHorizontalBox::Slot().AutoWidth()
				[
					SNew(SBox).WidthOverride(350.f)
					[
						SNew(SVerticalBox)
						+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 2) [ BuildPropGrid() ]
						+ SVerticalBox::Slot().FillHeight(1.f)
						[
							SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Panel).Padding(8)
							[ PropsBox.ToSharedRef() ]
						]
					]
				]
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0, 2, 0, 0)
			[
				SNew(SBox).HeightOverride(110.f)
				[
					SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Panel).Padding(FMargin(6, 3))
					[ LogBox.ToSharedRef() ]
				]
			]
			+ SVerticalBox::Slot().AutoHeight() [ CmdRow ]
			+ SVerticalBox::Slot().AutoHeight() [ BuildStatusBar() ]
		]
	];

	LogInfo(FString::Printf(TEXT("%s iniciado. Programa nuevo: %s%s"), *Theme.WindowTitle, *JobName, *Theme.JobExt));
	LogInfo(TEXT("Programa vacío. Empieza en 1. Importar."));
	RebuildCenter();
	RebuildTree();
	RebuildPanel();
}

// ------------------------------------------------------------------------------------------------
// Registro
// ------------------------------------------------------------------------------------------------
void SMachineSoftware::AddLog(const FString& Msg, const FLinearColor& Color)
{
	if (!LogBox.IsValid()) { return; }
	const FString Line = FString::Printf(TEXT("[%s] %s"), *FDateTime::Now().ToString(TEXT("%H:%M:%S")), *Msg);
	LogBox->AddSlot()
	[
		SNew(STextBlock).Text(Tx(Line)).Font(AcademiaUI::Mono(11)).ColorAndOpacity(Color).AutoWrapText(true)
	];
	LogBox->ScrollToEnd();
}
void SMachineSoftware::LogInfo(const FString& Msg) { AddLog(Msg, Theme.Muted); }
void SMachineSoftware::LogOk(const FString& Msg) { AddLog(Msg, AcademiaUI::Good); }
void SMachineSoftware::LogWarn(const FString& Msg) { AddLog(Msg, AcademiaUI::Warn); }
void SMachineSoftware::LogErr(const FString& Msg) { AddLog(Msg, AcademiaUI::Bad); }

// ------------------------------------------------------------------------------------------------
// Widgets auxiliares
// ------------------------------------------------------------------------------------------------
TSharedRef<SWidget> SMachineSoftware::Txt(const FString& S, int32 Size, const FLinearColor& Color, bool bBold) const
{
	return SNew(STextBlock).Text(Tx(S)).Font(AcademiaUI::Font(Size, bBold)).ColorAndOpacity(Color).AutoWrapText(true);
}

TSharedRef<SWidget> SMachineSoftware::Btn(const FString& Label, TFunction<void()> OnClick, bool bPrimary, TFunction<bool()> IsEnabled, int32 Size) const
{
	const FLinearColor Fill = bPrimary ? Theme.Accent : Theme.Panel2;
	const FLinearColor TextCol = bPrimary ? FLinearColor::White : Theme.Text;
	return SNew(SButton)
		.ButtonColorAndOpacity(FSlateColor(Fill))
		.ContentPadding(FMargin(8, 4))
		.IsEnabled_Lambda([IsEnabled]() { return IsEnabled ? IsEnabled() : true; })
		.OnClicked_Lambda([OnClick]() { if (OnClick) { OnClick(); } return FReply::Handled(); })
		[
			SNew(STextBlock).Text(Tx(Label)).Font(AcademiaUI::Font(Size, bPrimary)).ColorAndOpacity(TextCol).AutoWrapText(true).Justification(ETextJustify::Center)
		];
}

TSharedRef<SWidget> SMachineSoftware::ToggleBtn(const FString& Label, TFunction<void()> OnClick, TFunction<bool()> IsOn, int32 Size) const
{
	const FLinearColor OnCol = Theme.Accent, OffCol = Theme.Panel2;
	const FLinearColor TextOn = FLinearColor::White, TextOff = Theme.Text;
	return SNew(SButton)
		.ButtonColorAndOpacity_Lambda([IsOn, OnCol, OffCol]() { return FSlateColor((IsOn && IsOn()) ? OnCol : OffCol); })
		.ContentPadding(FMargin(6, 3))
		.OnClicked_Lambda([OnClick]() { if (OnClick) { OnClick(); } return FReply::Handled(); })
		[
			SNew(STextBlock).Text(Tx(Label)).Font(AcademiaUI::Font(Size, false))
			.ColorAndOpacity_Lambda([IsOn, TextOn, TextOff]() { return FSlateColor((IsOn && IsOn()) ? TextOn : TextOff); })
			.AutoWrapText(true)
		];
}

TSharedRef<SWidget> SMachineSoftware::Group(const FString& Title, TSharedRef<SWidget> Content) const
{
	return SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 6, 0, 2) [ Txt(Title, 12, Theme.Accent, true) ]
		+ SVerticalBox::Slot().AutoHeight() [ Content ];
}

// ------------------------------------------------------------------------------------------------
// Marco de la ventana
// ------------------------------------------------------------------------------------------------
TSharedRef<SWidget> SMachineSoftware::BuildTitleBar()
{
	const FString Title = FString::Printf(TEXT("%s    -    Nuevo programa: PRACTICA01_%s%s"), *Theme.WindowTitle, *Mode.ToUpper(), *Theme.JobExt);
	return SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.TitleBar).Padding(FMargin(10, 4))
	[
		SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().FillWidth(1.f).VAlign(VAlign_Center)
		[ SNew(STextBlock).Text(Tx(Title)).Font(AcademiaUI::Font(13, true)).ColorAndOpacity(Theme.TitleText) ]
		+ SHorizontalBox::Slot().AutoWidth()
		[
			Btn(TEXT("← Volver"), [this]()
			{
				if (const TSharedPtr<SAcademiaShell> S = Shell.Pin()) { S->Back(); }
			})
		]
	];
}

TSharedRef<SWidget> SMachineSoftware::BuildMenuBar()
{
	TSharedRef<SHorizontalBox> Row = SNew(SHorizontalBox);
	for (int32 i = 0; i < Theme.Menus.Num(); ++i)
	{
		const bool bActive = (i == Theme.ActiveMenu);
		const FLinearColor Fill = bActive ? Theme.Accent : Theme.Panel;
		const FLinearColor TextCol = bActive ? FLinearColor::White : Theme.Text;
		Row->AddSlot().AutoWidth().Padding(0, 0, 1, 0)
		[
			SAssignNew(MenuAnchors[i], SMenuAnchor)
			.Placement(MenuPlacement_BelowAnchor)
			.OnGetMenuContent(FOnGetContent::CreateLambda([this, i]() { return BuildMenuContent(i); }))
			[
				SNew(SButton)
				.ButtonColorAndOpacity(FSlateColor(Fill))
				.ContentPadding(FMargin(Theme.bRibbon ? 16.f : 10.f, 4.f))
				.OnClicked_Lambda([this, i]()
				{
					if (MenuAnchors.IsValidIndex(i) && MenuAnchors[i].IsValid())
					{
						MenuAnchors[i]->SetIsOpen(!MenuAnchors[i]->IsOpen());
					}
					return FReply::Handled();
				})
				[
					SNew(STextBlock).Text(Tx(Theme.Menus[i].Name)).Font(AcademiaUI::Font(13, bActive)).ColorAndOpacity(TextCol)
				]
			]
		];
	}
	return SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Panel).Padding(FMargin(4, 2))[ Row ];
}

TSharedRef<SWidget> SMachineSoftware::BuildMenuContent(int32 MenuIndex)
{
	TSharedRef<SVerticalBox> Col = SNew(SVerticalBox);
	if (Theme.Menus.IsValidIndex(MenuIndex))
	{
		for (const FSwMenuItem& Item : Theme.Menus[MenuIndex].Items)
		{
			const FString Name = Item.Name;
			const int32 Act = Item.Act;
			Col->AddSlot().AutoHeight()
			[
				SNew(SButton)
				.ButtonColorAndOpacity(FSlateColor(Theme.Panel))
				.ContentPadding(FMargin(12, 4))
				.OnClicked_Lambda([this, MenuIndex, Name, Act]()
				{
					if (MenuAnchors.IsValidIndex(MenuIndex) && MenuAnchors[MenuIndex].IsValid()) { MenuAnchors[MenuIndex]->SetIsOpen(false); }
					HandleAction(Name, Act);
					return FReply::Handled();
				})
				[
					SNew(STextBlock).Text(Tx(Name)).Font(AcademiaUI::Font(13)).ColorAndOpacity(Theme.Text)
				]
			];
		}
	}
	return SNew(SBox).MinDesiredWidth(170.f)
	[
		SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Panel).Padding(2)[ Col ]
	];
}

TSharedRef<SWidget> SMachineSoftware::BuildToolBar()
{
	TSharedRef<SHorizontalBox> Row = SNew(SHorizontalBox);
	for (const FSwMenuItem& Item : Theme.Tools)
	{
		if (Item.Name.StartsWith(TEXT("|")))
		{
			const FString Label = Item.Name.Mid(1);
			Row->AddSlot().AutoWidth().VAlign(VAlign_Center).Padding(8, 0, 4, 0)
			[ Txt(Label.IsEmpty() ? TEXT("│") : Label + TEXT(":"), 11, Theme.Muted, true) ];
			continue;
		}
		const FString Name = Item.Name;
		const int32 Act = Item.Act;
		Row->AddSlot().AutoWidth().Padding(1, 0)
		[ Btn(Name, [this, Name, Act]() { HandleAction(Name, Act); }, Act == 4, nullptr, 11) ];
	}
	// Indicador de rayos X del V810 (amarillo, como en la consola real)
	if (Theme.bXray)
	{
		Row->AddSlot().FillWidth(1.f).HAlign(HAlign_Right).VAlign(VAlign_Center).Padding(0, 0, 6, 0)
		[
			SNew(SBorder).BorderImage(AcademiaUI::White())
			.BorderBackgroundColor_Lambda([this]() { return FSlateColor(bRunning ? FLinearColor(1.f, 0.85f, 0.f) : FLinearColor(0.2f, 0.17f, 0.f)); })
			.Padding(FMargin(10, 3))
			[
				SNew(STextBlock).Font(AcademiaUI::Font(13, true))
				.Text_Lambda([this]() { return Tx(bRunning ? TEXT("X-RAY ON") : TEXT("X-RAY OFF")); })
				.ColorAndOpacity_Lambda([this]() { return FSlateColor(bRunning ? FLinearColor(0.f, 0.f, 0.f) : FLinearColor(0.9f, 0.75f, 0.1f)); })
			]
		];
	}
	return SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Bg).Padding(FMargin(4, 3))[ Row ];
}

TSharedRef<SWidget> SMachineSoftware::BuildTabStrip()
{
	static const TCHAR* Names[5] = { TEXT("1. Importar"), TEXT("2. Fiduciales"), TEXT("3. Librería"), TEXT("4. Umbrales"), TEXT("5. Correr lote") };
	TSharedRef<SHorizontalBox> Row = SNew(SHorizontalBox);
	for (int32 i = 0; i < 5; ++i)
	{
		Row->AddSlot().AutoWidth().Padding(0, 0, 2, 0)
		[ ToggleBtn(Names[i], [this, i]() { SetTab(i); }, [this, i]() { return Tab == i; }, 13) ];
	}
	return SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Panel).Padding(FMargin(4, 3))[ Row ];
}

TSharedRef<SWidget> SMachineSoftware::BuildPropGrid()
{
	return SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Panel).Padding(8)
	[
		SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 0, 0, 4) [ Txt(Theme.PropTitle, 12, Theme.Accent, true) ]
		+ SVerticalBox::Slot().AutoHeight()
		[
			SNew(STextBlock).Font(AcademiaUI::Mono(11)).ColorAndOpacity(Theme.Text).AutoWrapText(true)
			.Text_Lambda([this]() { return Tx(SelectionInfo()); })
		]
	];
}

TSharedRef<SWidget> SMachineSoftware::BuildStatusBar()
{
	auto Cell = [this](TAttribute<FText> T) -> TSharedRef<SWidget>
	{
		return SNew(SBorder).BorderImage(AcademiaUI::White()).BorderBackgroundColor(Theme.Panel2).Padding(FMargin(8, 2))
		[ SNew(STextBlock).Text(T).Font(AcademiaUI::Font(11)).ColorAndOpacity(Theme.Text) ];
	};
	return SNew(SHorizontalBox)
		+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 2, 0)
		[ Cell(TAttribute<FText>::CreateLambda([this]() { return Tx(bRunning ? Theme.BusyText : Theme.ReadyText); })) ]
		+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 2, 0)
		[ Cell(TAttribute<FText>::CreateLambda([this]() { return Tx(FString::Printf(TEXT("%s: %s"), *Theme.ConveyorName, bRunning ? TEXT("Running") : TEXT("Idle"))); })) ]
		+ SHorizontalBox::Slot().AutoWidth().Padding(0, 0, 2, 0)
		[ Cell(TAttribute<FText>::CreateLambda([this]() { return Tx(Board.IsValid() ? FString::Printf(TEXT("Job: PRACTICA01_%s%s"), *Mode.ToUpper(), *Theme.JobExt) : FString(TEXT("Job: (ninguno)"))); })) ]
		+ SHorizontalBox::Slot().FillWidth(1.f)
		[ Cell(TAttribute<FText>::CreateLambda([this]()
		{
			const FString B = Board.IsValid() ? FString::Printf(TEXT("%.0f x %.0f mm"), Board->Width, Board->Height) : FString(TEXT("-"));
			return Tx(FString::Printf(TEXT("Paso %d/5   |   Unidades: mm   |   Tarjeta: %s   |   Fiduciales: %d/%d"), Tab + 1, *B, Fids.Num(), RequiredFids()));
		})) ];
}

// ------------------------------------------------------------------------------------------------
// Árbol del trabajo: Board > Array > Componentes por encapsulado
// ------------------------------------------------------------------------------------------------
void SMachineSoftware::RebuildTree()
{
	if (TreeBox.IsValid()) { TreeBox->SetContent(BuildTree()); }
}

FString SMachineSoftware::AlgoName(const FString& Key) const
{
	for (const TPair<FString, FString>& A : Def.Algos) { if (A.Key == Key) { return A.Value; } }
	return Key;
}

TArray<FString> SMachineSoftware::PackageList() const
{
	TArray<FString> Out;
	if (Board.IsValid()) { for (const FBoardComponent& C : Board->Comps) { Out.AddUnique(C.Package); } }
	return Out;
}

int32 SMachineSoftware::RequiredFids() const
{
	int32 N = 0;
	if (Board.IsValid()) { for (const FBoardComponent& C : Board->Comps) { if (C.Ref.StartsWith(TEXT("FID"))) { ++N; } } }
	return N;
}

TSharedRef<SWidget> SMachineSoftware::BuildTree()
{
	TSharedRef<SScrollBox> Box = SNew(SScrollBox);
	if (!Board.IsValid())
	{
		Box->AddSlot()[ Txt(TEXT("Programa vacío"), 12, Theme.Muted) ];
		return Box;
	}
	const FButtonStyle* Flat = &FCoreStyle::Get().GetWidgetStyle<FButtonStyle>("NoBorder");
	auto Header = [&](const FString& S, int32 Indent)
	{
		Box->AddSlot().Padding(Indent * 12.f, 2, 0, 0)[ Txt(TEXT("▾ ") + S, 12, Theme.Text, true) ];
	};
	auto Row = [&](const FBoardComponent& C, const FString& Label, int32 Indent)
	{
		FLinearColor Col = Theme.Text;
		FString Suffix;
		if (const FString* Bad = NG.Find(C.Ref))
		{
			Col = (*Bad == TEXT("falso")) ? AcademiaUI::Warn : AcademiaUI::Bad;
			Suffix = TEXT("  ✕ ") + *Bad;
		}
		else if (C.Ref.StartsWith(TEXT("FID"))) { Col = Fids.Contains(C.Ref) ? AcademiaUI::Good : Theme.Text; }
		else if (Lib.Contains(C.Package) && !Lib[C.Package].IsEmpty()) { Col = AcademiaUI::Good; }
		const FString Ref = C.Ref;
		Box->AddSlot().Padding(Indent * 12.f, 0, 0, 0)
		[
			SNew(SButton).ButtonStyle(Flat).ContentPadding(FMargin(2, 1))
			.OnClicked_Lambda([this, Ref]() { HandleTreeClick(Ref); return FReply::Handled(); })
			[ SNew(STextBlock).Text(Tx(Label + Suffix)).Font(AcademiaUI::Font(11)).ColorAndOpacity(Col) ]
		];
	};

	Header(FString::Printf(TEXT("%s %s"), *Theme.TreeRoot, *Board->Name), 0);
	Header(TEXT("Array 1 (1 x 1)"), 1);

	int32 FidCount = 0;
	for (const FBoardComponent& C : Board->Comps) { if (C.Ref.StartsWith(TEXT("FID"))) { ++FidCount; } }
	if (FidCount > 0)
	{
		Header(FString::Printf(TEXT("Fiduciales (%d)"), FidCount), 2);
		for (const FBoardComponent& C : Board->Comps) { if (C.Ref.StartsWith(TEXT("FID"))) { Row(C, TEXT("◎ ") + C.Ref, 3); } }
	}
	for (const FString& Pkg : PackageList())
	{
		if (Pkg == TEXT("FID")) { continue; }
		int32 N = 0;
		for (const FBoardComponent& C : Board->Comps) { if (C.Package == Pkg && !C.Ref.StartsWith(TEXT("FID"))) { ++N; } }
		if (N == 0) { continue; }
		const FString* L = Lib.Find(Pkg);
		const FString Algo = (L && !L->IsEmpty()) ? AlgoName(*L) : FString(TEXT("sin asignar"));
		Header(FString::Printf(TEXT("%s [%s] (%d)"), *Pkg, *Algo, N), 2);
		for (const FBoardComponent& C : Board->Comps)
		{
			if (C.Package == Pkg && !C.Ref.StartsWith(TEXT("FID"))) { Row(C, FString::Printf(TEXT("%s  %s"), *C.Ref, *C.Value), 3); }
		}
	}
	return Box;
}

FString SMachineSoftware::SelectionInfo() const
{
	if (!Board.IsValid() || SelRef.IsEmpty()) { return TEXT("(sin selección)\nHaz clic en un componente de la tarjeta o del árbol."); }
	const FBoardComponent* C = Board->FindComp(SelRef);
	if (!C) { return TEXT("(sin selección)"); }
	FString RoiTxt = TEXT("-");
	if (const FBoardPackage* P = Board->Packages.Find(C->Package))
	{
		FVector2D Body = P->Body;
		if (FMath::Fmod(FMath::Abs(C->Rotation), 180.f) > 45.f) { Swap(Body.X, Body.Y); }
		RoiTxt = FString::Printf(TEXT("%.2f x %.2f mm"), Body.X, Body.Y);
	}
	const FString* L = Lib.Find(C->Package);
	const FString Algo = (L && !L->IsEmpty()) ? AlgoName(*L) : FString(TEXT("sin asignar"));
	return FString::Printf(TEXT("Ref:       %s\nValor:     %s\nPackage:   %s\n%s: %s\nX / Y:     %.2f / %.2f mm\nRotación:  %.0f°\nROI:       %s"),
		*C->Ref, *C->Value, *C->Package, *Theme.AlgoLabel, *Algo, C->Pos.X, C->Pos.Y, C->Rotation, *RoiTxt);
}

// ------------------------------------------------------------------------------------------------
// Vista central
// ------------------------------------------------------------------------------------------------
void SMachineSoftware::RebuildCenter()
{
	if (!CenterBox.IsValid()) { return; }
	BoardView.Reset();
	if (!Board.IsValid())
	{
		CenterBox->SetContent(SNew(SBox).HAlign(HAlign_Center).VAlign(VAlign_Center)[ Txt(TEXT("Sin tarjeta cargada"), 16, Theme.Muted) ]);
		return;
	}
	SAssignNew(BoardView, SBoardView)
		.Board(Board)
		.Layers(TAttribute<uint32>::CreateLambda([this]() { return LayerMask; }))
		.OnComponentClicked(FOnBoardComponentClicked::CreateSP(this, &SMachineSoftware::HandleComponentClicked));

	if (Theme.bCmdLine)
	{
		// ICT: tarjeta arriba y el testplan de solo lectura abajo
		PlanText = BuildPlanText();
		SAssignNew(PlanBox, SMultiLineEditableTextBox)
			.Text_Lambda([this]() { return Tx(PlanText); })
			.Font(AcademiaUI::Mono(11))
			.IsReadOnly(true)
			.ReadOnlyForegroundColor(FSlateColor(Theme.Text))
			.BackgroundColor(FSlateColor(Theme.Bg));
		CenterBox->SetContent(
			SNew(SVerticalBox)
			+ SVerticalBox::Slot().FillHeight(0.5f) [ BoardView.ToSharedRef() ]
			+ SVerticalBox::Slot().AutoHeight().Padding(4, 2) [ Txt(TEXT("Testplan (solo lectura) - generado desde la tarjeta y los umbrales"), 11, Theme.Accent, true) ]
			+ SVerticalBox::Slot().FillHeight(0.5f) [ PlanBox.ToSharedRef() ]);
	}
	else
	{
		CenterBox->SetContent(BoardView.ToSharedRef());
	}
	RefreshMarkers();
}

void SMachineSoftware::RefreshMarkers()
{
	if (!BoardView.IsValid() || !Board.IsValid()) { return; }
	TMap<FString, FLinearColor> M;
	if (Tab == 1)
	{
		for (const FString& F : Fids) { M.Add(F, AcademiaUI::Good); }
	}
	else if (Tab == 4)
	{
		for (const TPair<FString, FString>& KV : NG) { M.Add(KV.Key, KV.Value == TEXT("falso") ? AcademiaUI::Warn : AcademiaUI::Bad); }
	}
	BoardView->SetMarkers(M);
	BoardView->SetHighlight(SelRef);
}

// ------------------------------------------------------------------------------------------------
// Navegación del flujo
// ------------------------------------------------------------------------------------------------
void SMachineSoftware::SetTab(int32 NewTab)
{
	NewTab = FMath::Clamp(NewTab, 0, 4);
	if (NewTab > 0 && !Board.IsValid()) { LogErr(TEXT("Primero importa los archivos de la tarjeta.")); if (UAcademiaGameInstance* G = GI()) { G->Sfx(EAcademiaSfx::Bad); } return; }
	if (NewTab > 1 && Fids.Num() < RequiredFids()) { LogErr(FString::Printf(TEXT("Registra todos los fiduciales (%d/%d) en 2. Fiduciales."), Fids.Num(), RequiredFids())); if (UAcademiaGameInstance* G = GI()) { G->Sfx(EAcademiaSfx::Bad); } return; }
	Tab = NewTab;
	if (Tab == 3) { UpdateEstimate(); }
	if (UAcademiaGameInstance* G = GI()) { G->Sfx(EAcademiaSfx::Click); }
	RefreshMarkers();
	RebuildPanel();
}

void SMachineSoftware::RebuildPanel()
{
	if (PropsBox.IsValid()) { PropsBox->SetContent(BuildPanel()); }
}

TSharedRef<SWidget> SMachineSoftware::BuildPanel()
{
	TSharedRef<SWidget> Content = SNullWidget::NullWidget;
	switch (Tab)
	{
	case 0: Content = BuildPanelImport(); break;
	case 1: Content = BuildPanelFiducials(); break;
	case 2: Content = BuildPanelLibrary(); break;
	case 3: Content = BuildPanelThresholds(); break;
	default: Content = BuildPanelRun(); break;
	}
	return SNew(SScrollBox) + SScrollBox::Slot()[ Content ];
}

void SMachineSoftware::HandleAction(const FString& Name, int32 Act)
{
	if (UAcademiaGameInstance* G = GI()) { G->Sfx(EAcademiaSfx::Click); }
	if (Act == -2)
	{
		if (const TSharedPtr<SAcademiaShell> S = Shell.Pin()) { S->Back(); }
		return;
	}
	if (Act >= 0)
	{
		LogInfo(FString::Printf(TEXT("Menú: %s"), *Name));
		if (Act == 0 && Board.IsValid() == false) { ImportDefault(); }
		SetTab(Act);
		if (Act == 4 && Board.IsValid() && Fids.Num() >= RequiredFids() && (Name.StartsWith(TEXT("Run")) || Name.StartsWith(TEXT("Start")) || Name.Contains(TEXT("Debug"))))
		{
			StartRun();
		}
		return;
	}
	LogInfo(FString::Printf(TEXT("'%s' existe en el software real, pero no se simula en esta práctica."), *Name));
}

void SMachineSoftware::HandleTreeClick(const FString& Ref)
{
	SelRef = Ref;
	if (BoardView.IsValid()) { BoardView->SetHighlight(Ref); }
	if (!Board.IsValid()) { return; }
	if (const FBoardComponent* C = Board->FindComp(Ref))
	{
		const FString* L = Lib.Find(C->Package);
		LogInfo(FString::Printf(TEXT("%s: %s - %s - X %.2f Y %.2f - rot %.0f° - %s %s"), *C->Ref, *C->Value, *C->Package, C->Pos.X, C->Pos.Y, C->Rotation, *Theme.AlgoLabel,
			(L && !L->IsEmpty()) ? *AlgoName(*L) : TEXT("sin asignar")));
	}
}

void SMachineSoftware::HandleComponentClicked(const FString& Ref)
{
	if (Tab != 1) { HandleTreeClick(Ref); return; }
	// 2. Fiduciales: solo cuentan las marcas FID
	UAcademiaGameInstance* G = GI();
	SelRef = Ref;
	if (!Ref.StartsWith(TEXT("FID")))
	{
		if (G) { G->Sfx(EAcademiaSfx::Bad); }
		LogErr(FString::Printf(TEXT("%s no es un fiducial: un componente puede moverse y no sirve de referencia."), *Ref));
		return;
	}
	if (!Fids.Contains(Ref))
	{
		Fids.Add(Ref);
		if (G) { G->Sfx(EAcademiaSfx::Ok); }
		if (const FBoardComponent* C = Board->FindComp(Ref))
		{
			LogOk(FString::Printf(TEXT("Fiducial %s registrado en X %.2f Y %.2f. Calificación 0.97"), *Ref, C->Pos.X, C->Pos.Y));
		}
		if (Fids.Num() >= RequiredFids())
		{
			LogOk(TEXT("Alineación correcta: todos los fiduciales registrados (posición, rotación y escala)."));
		}
		RebuildTree();
		RebuildPanel();
	}
	RefreshMarkers();
}

// ------------------------------------------------------------------------------------------------
// Importar
// ------------------------------------------------------------------------------------------------
void SMachineSoftware::ApplyBoard(TSharedPtr<FLoadedBoard> NewBoard, const FString& Origin)
{
	Board = NewBoard;
	Fids.Empty(); Lib.Empty(); NG.Empty(); SelRef.Empty();
	bHasRun = false; bReleased = false; bLibChecked = false; Tips.Empty();
	const FLoadedBoard& B = *Board;
	LogInfo(FString::Printf(TEXT("Origen: %s"), *Origin));
	LogOk(FString::Printf(TEXT("Gerber cobre: %d pads, %d pistas"), B.Copper.Flashes.Num(), B.Copper.Lines.Num()));
	if (!B.Paste.IsEmpty()) { LogOk(FString::Printf(TEXT("Gerber pasta: %d aperturas de stencil"), B.Paste.Flashes.Num())); }
	if (B.Holes.Num() > 0) { LogOk(FString::Printf(TEXT("Excellon: %d barrenos"), B.Holes.Num())); }
	LogOk(FString::Printf(TEXT("Centroides: %d componentes, %d encapsulados"), B.Comps.Num(), PackageList().Num()));
	if (B.Nets.Num() > 0)
	{
		TSet<FString> NetNames; for (const FNetPoint& N : B.Nets) { NetNames.Add(N.Net); }
		LogOk(FString::Printf(TEXT("IPC-D-356: %d puntos de red, %d redes"), B.Nets.Num(), NetNames.Num()));
	}
	for (const FString& W : B.Warnings) { LogWarn(W); }
	if (UAcademiaGameInstance* G = GI()) { G->Sfx(EAcademiaSfx::Ok); }
	UpdateEstimate();
	RebuildCenter();
	RebuildTree();
	RebuildPanel();
}

void SMachineSoftware::ImportDefault()
{
	UAcademiaGameInstance* G = GI();
	if (!G || !G->Content().Board.IsValid() || G->Content().Board->Comps.Num() == 0)
	{
		LogErr(TEXT("No hay tarjeta de práctica en el contenido del curso (boards/practica01)."));
		return;
	}
	ApplyBoard(G->Content().Board, G->Content().Board->Name);
}

void SMachineSoftware::ImportFolder()
{
	UAcademiaGameInstance* G = GI();
	if (!G) { return; }
	const FString Dir = FPaths::Combine(G->Content().RootDir, TEXT("import"));
	TArray<FString> Names;
	IFileManager::Get().FindFiles(Names, *FPaths::Combine(Dir, TEXT("*.*")), true, false);
	ImportInfo = FString::Printf(TEXT("Carpeta: %s  (%d archivos)"), *Dir, Names.Num());
	if (Names.Num() == 0)
	{
		LogErr(FString::Printf(TEXT("La carpeta %s está vacía. Copia ahí tus Gerber, .drl, centroides .csv e .ipc."), *Dir));
		RebuildPanel();
		return;
	}
	TArray<FString> Paths;
	for (const FString& N : Names)
	{
		Paths.Add(FPaths::Combine(Dir, N));
		LogInfo(FString::Printf(TEXT("Leído %s"), *N));
	}
	TSharedPtr<FLoadedBoard> NB = MakeShared<FLoadedBoard>();
	const bool bOk = AcademiaGerber::LoadBoardFromFiles(Paths, *NB);
	if (!bOk || NB->Comps.Num() == 0)
	{
		LogErr(TEXT("No se encontraron centroides: agrega también el archivo CSV de pick & place."));
		RebuildPanel();
		return;
	}
	if (NB->Packages.Num() == 0 && G->Content().Board.IsValid()) { NB->Packages = G->Content().Board->Packages; }
	if (NB->Name.IsEmpty()) { NB->Name = TEXT("Tarjeta del usuario"); }
	ApplyBoard(NB, TEXT("CursoData/import"));
}

TSharedRef<SWidget> SMachineSoftware::BuildPanelImport()
{
	FString Desc = TEXT("No hay tarjeta de práctica en el contenido.");
	if (UAcademiaGameInstance* G = GI())
	{
		if (G->Content().Board.IsValid()) { Desc = G->Content().Board->Description; }
	}
	TSharedRef<SVerticalBox> Layers = SNew(SVerticalBox);
	static const uint32 All[8] = { EBoardLayer::Copper, EBoardLayer::Mask, EBoardLayer::Paste, EBoardLayer::Silk, EBoardLayer::Drill, EBoardLayer::Comps, EBoardLayer::TestPoints, EBoardLayer::Refs };
	for (const uint32 Bit : All)
	{
		Layers->AddSlot().AutoHeight()
		[
			SNew(SCheckBox)
			.IsChecked_Lambda([this, Bit]() { return (LayerMask & Bit) ? ECheckBoxState::Checked : ECheckBoxState::Unchecked; })
			.OnCheckStateChanged_Lambda([this, Bit](ECheckBoxState S) { if (S == ECheckBoxState::Checked) { LayerMask |= Bit; } else { LayerMask &= ~Bit; } })
			[ Txt(LayerName(Bit), 12, Theme.Text) ]
		];
	}
	return SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight() [ Txt(TEXT("1. Importar datos de CAD"), 15, Theme.Text, true) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4) [ Txt(Desc, 11, Theme.Muted) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
		[ Btn(Board.IsValid() ? TEXT("Reimportar PRACTICA-01") : TEXT("Importar PRACTICA-01"), [this]() { ImportDefault(); }, true) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
		[ Btn(TEXT("Importar archivos de CursoData/import"), [this]() { ImportFolder(); }) ]
		+ SVerticalBox::Slot().AutoHeight() [ Txt(ImportInfo.IsEmpty() ? TEXT("Archivos admitidos: Gerber, .drl, centroides .csv, .ipc") : ImportInfo, 10, Theme.Muted) ]
		+ SVerticalBox::Slot().AutoHeight() [ Group(TEXT("Capas"), Layers) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 8)
		[ Btn(TEXT("Siguiente: Fiduciales →"), [this]() { SetTab(1); }, false, [this]() { return Board.IsValid(); }) ];
}

// ------------------------------------------------------------------------------------------------
// Fiduciales
// ------------------------------------------------------------------------------------------------
TSharedRef<SWidget> SMachineSoftware::BuildPanelFiducials()
{
	TSharedRef<SVerticalBox> List = SNew(SVerticalBox);
	if (Board.IsValid())
	{
		for (const FBoardComponent& C : Board->Comps)
		{
			if (!C.Ref.StartsWith(TEXT("FID"))) { continue; }
			const bool bDone = Fids.Contains(C.Ref);
			List->AddSlot().AutoHeight()
			[ Txt(FString::Printf(TEXT("%s %s%s"), bDone ? TEXT("✔") : TEXT("○"), bDone ? *C.Ref : TEXT("Fiducial sin registrar"), bDone ? *FString::Printf(TEXT("  (X %.1f, Y %.1f)"), C.Pos.X, C.Pos.Y) : TEXT("")), 12, bDone ? AcademiaUI::Good : Theme.Muted) ];
		}
	}
	return SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight() [ Txt(TEXT("2. Alinear con fiduciales"), 15, Theme.Text, true) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
		[ Txt(TEXT("Haz clic sobre cada fiducial en la vista de la tarjeta (marcas redondas de cobre sin pasta, en las esquinas). Con tres, en esquinas distintas, se corrigen posición, rotación y escala."), 11, Theme.Muted) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
		[ Txt(FString::Printf(TEXT("Registrados: %d/%d"), Fids.Num(), RequiredFids()), 13, Theme.Text, true) ]
		+ SVerticalBox::Slot().AutoHeight() [ List ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 6)
		[ Btn(TEXT("Borrar alineación"), [this]() { Fids.Empty(); LogInfo(TEXT("Alineación borrada.")); RefreshMarkers(); RebuildTree(); RebuildPanel(); }) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
		[ Btn(TEXT("Siguiente: Librería →"), [this]() { SetTab(2); }, true, [this]() { return Fids.Num() >= RequiredFids(); }) ];
}

// ------------------------------------------------------------------------------------------------
// Librería
// ------------------------------------------------------------------------------------------------
bool SMachineSoftware::AlgoOK(const FBoardComponent& C) const
{
	const FString* L = Lib.Find(C.Package);
	if (!L || L->IsEmpty()) { return false; }
	const FString Good = Board->AlgoOf(C.Package);
	if (*L == Good) { return true; }
	// En SPI varios algoritmos comparten nombre: se consideran equivalentes
	return Mode == TEXT("spi") && AlgoName(*L) == AlgoName(Good);
}

void SMachineSoftware::VerifyLibrary()
{
	if (!Board.IsValid()) { return; }
	int32 Ok = 0, N = 0;
	for (const FString& P : PackageList())
	{
		if (P == TEXT("FID")) { continue; }
		if (P == TEXT("TP")) { if (!Lib.Contains(P) || Lib[P].IsEmpty()) { Lib.Add(P, TEXT("PTH")); } continue; }
		++N;
		const FString* L = Lib.Find(P);
		const FString Good = Board->AlgoOf(P);
		const bool bGood = L && !L->IsEmpty() && (*L == Good || (Mode == TEXT("spi") && AlgoName(*L) == AlgoName(Good)));
		if (bGood) { ++Ok; } else { LogWarn(FString::Printf(TEXT("%s: %s."), *P, (L && !L->IsEmpty()) ? TEXT("algoritmo no adecuado") : TEXT("sin asignar"))); }
	}
	bLibChecked = true;
	const bool bAll = (Ok == N);
	AddLog(FString::Printf(TEXT("Librería: %d/%d encapsulados con el algoritmo adecuado."), Ok, N), bAll ? AcademiaUI::Good : AcademiaUI::Warn);
	if (UAcademiaGameInstance* G = GI()) { G->Sfx(bAll ? EAcademiaSfx::Ok : EAcademiaSfx::Bad); }
	RebuildTree();
}

TSharedRef<SWidget> SMachineSoftware::BuildPanelLibrary()
{
	TSharedRef<SVerticalBox> Col = SNew(SVerticalBox);
	if (Board.IsValid())
	{
		for (const FString& Pkg : PackageList())
		{
			if (Pkg == TEXT("FID") || (Mode == TEXT("spi") && Pkg == TEXT("TP"))) { continue; }
			FString Refs; int32 Shown = 0, Total = 0;
			for (const FBoardComponent& C : Board->Comps)
			{
				if (C.Package != Pkg) { continue; }
				++Total;
				if (Shown < 4) { Refs += (Shown ? TEXT(", ") : TEXT("")) + C.Ref; ++Shown; }
			}
			TSharedRef<SUniformGridPanel> Grid = SNew(SUniformGridPanel).SlotPadding(FMargin(1.f));
			int32 Idx = 0;
			for (const TPair<FString, FString>& A : Def.Algos)
			{
				const FString Key = A.Key;
				Grid->AddSlot(Idx % 2, Idx / 2)
				[
					ToggleBtn(A.Value, [this, Pkg, Key]() { Lib.Add(Pkg, Key); bLibChecked = false; RebuildTree(); }, [this, Pkg, Key]() { const FString* L = Lib.Find(Pkg); return L && *L == Key; }, 10)
				];
				++Idx;
			}
			Col->AddSlot().AutoHeight().Padding(0, 4)
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight() [ Txt(FString::Printf(TEXT("%s  (%s%s)"), *Pkg, *Refs, Total > Shown ? TEXT("...") : TEXT("")), 12, Theme.Text, true) ]
				+ SVerticalBox::Slot().AutoHeight() [ Grid ]
			];
		}
	}
	return SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight() [ Txt(TEXT("3. Librería"), 15, Theme.Text, true) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
		[ Txt(FString::Printf(TEXT("Asigna a cada tipo de encapsulado el %s correcto."), Mode == TEXT("ict") ? TEXT("tipo de prueba") : TEXT("algoritmo")), 11, Theme.Muted) ]
		+ SVerticalBox::Slot().AutoHeight() [ Col ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 6) [ Btn(TEXT("Verificar librería"), [this]() { VerifyLibrary(); RebuildPanel(); }, true) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 2)
		[ Btn(TEXT("Siguiente: Umbrales →"), [this]() { SetTab(3); }) ];
}

// ------------------------------------------------------------------------------------------------
// Umbrales
// ------------------------------------------------------------------------------------------------
void SMachineSoftware::UpdateEstimate()
{
	if (!Board.IsValid()) { EstF = EstE = 0; return; }
	const FSwSimResult R = Simulate(20, 7);
	EstF = R.Falses; EstE = R.Escapes;
	if (Theme.bCmdLine) { PlanText = BuildPlanText(); }
}

TSharedRef<SWidget> SMachineSoftware::BuildPanelThresholds()
{
	TSharedRef<SVerticalBox> Col = SNew(SVerticalBox);
	for (const FSwParam& P : Def.Params)
	{
		const FString K = P.K; const float Min = P.Min, Max = P.Max; const FString Unit = P.Unit; const FString Name = P.Name;
		Col->AddSlot().AutoHeight().Padding(0, 4)
		[
			SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight()
			[
				SNew(STextBlock).Font(AcademiaUI::Font(12)).ColorAndOpacity(Theme.Text)
				.Text_Lambda([this, K, Name, Unit]() { return Tx(FString::Printf(TEXT("%s: %.0f%s"), *Name, ParamVals.FindRef(K), *Unit)); })
			]
			+ SVerticalBox::Slot().AutoHeight().Padding(0, 2)
			[
				SNew(SSlider)
				.Value_Lambda([this, K, Min, Max]() { return (ParamVals.FindRef(K) - Min) / (Max - Min); })
				.OnValueChanged_Lambda([this, K, Min, Max](float N)
				{
					ParamVals.Add(K, FMath::RoundToFloat(Min + FMath::Clamp(N, 0.f, 1.f) * (Max - Min)));
					UpdateEstimate();
				})
			]
		];
	}
	return SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight() [ Txt(TEXT("4. Umbrales"), 15, Theme.Text, true) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
		[ Txt(TEXT("Muy estricto produce falsos llamados; muy laxo deja escapar defectos."), 11, Theme.Muted) ]
		+ SVerticalBox::Slot().AutoHeight() [ Col ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 8)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().FillWidth(1.f)
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight() [ Txt(TEXT("Falsos estimados"), 11, Theme.Muted) ]
				+ SVerticalBox::Slot().AutoHeight() [ SNew(STextBlock).Font(AcademiaUI::Font(22, true)).ColorAndOpacity(AcademiaUI::Warn).Text_Lambda([this]() { return Tx(FString::FromInt(EstF)); }) ]
			]
			+ SHorizontalBox::Slot().FillWidth(1.f)
			[
				SNew(SVerticalBox)
				+ SVerticalBox::Slot().AutoHeight() [ Txt(TEXT("Escapes estimados"), 11, Theme.Muted) ]
				+ SVerticalBox::Slot().AutoHeight() [ SNew(STextBlock).Font(AcademiaUI::Font(22, true)).ColorAndOpacity(AcademiaUI::Bad).Text_Lambda([this]() { return Tx(FString::FromInt(EstE)); }) ]
			]
		]
		+ SVerticalBox::Slot().AutoHeight() [ Txt(TEXT("Estimado con 20 tarjetas de prueba (golden + defectuosas)."), 10, Theme.Muted) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 8)
		[ Btn(TEXT("Siguiente: Correr lote →"), [this]() { SetTab(4); }, true) ];
}

// ------------------------------------------------------------------------------------------------
// Simulación (port exacto de simulate() de simui.js)
// ------------------------------------------------------------------------------------------------
FSwSimResult SMachineSoftware::Simulate(int32 N, int32 Seed) const
{
	FSwSimResult R;
	if (!Board.IsValid()) { return R; }
	FSwRng Rng; Rng.S = (int64)Seed * 7919 + 1;

	TArray<const FBoardComponent*> Comps;
	for (const FBoardComponent& C : Board->Comps) { if (!IsFidOrTp(C.Ref)) { Comps.Add(&C); } }
	if (Comps.Num() == 0) { return R; }

	struct FNorm { double K, Lo, Hi; };
	auto TNorm = [this](const FSwParam& P) -> FNorm
	{
		const double V = ParamVals.FindRef(P.K);
		const double Span = (double)(P.Max - P.Min);
		const double K = (V - P.Min) / Span, Lo = (P.TMin - P.Min) / Span, Hi = (P.TMax - P.Min) / Span;
		if (P.bInv) { return FNorm{ 1.0 - K, 1.0 - Hi, 1.0 - Lo }; }
		return FNorm{ K, Lo, Hi };
	};

	for (int32 i = 0; i < N; ++i)
	{
		const bool bDefective = Rng.Next() < 0.3;
		const FBoardComponent* DC = nullptr;
		if (bDefective) { DC = Comps[(int32)(Rng.Next() * Comps.Num())]; }

		const FSwDefect* Defect = nullptr;
		if (DC)
		{
			TArray<const FSwDefect*> Opts;
			const FString DcAlgo = Board->AlgoOf(DC->Package);
			for (const FSwDefect& D : Def.Defects) { if (D.Algo.IsEmpty() || D.Algo == DcAlgo) { Opts.Add(&D); } }
			Defect = Opts[(int32)(Rng.Next() * Opts.Num())];
		}

		bool bRealCaught = false;
		for (const FBoardComponent* C : Comps)
		{
			for (const FSwParam& P : Def.Params)
			{
				const FNorm T = TNorm(P);
				// Ruido de piezas buenas ~ debajo de T.Lo; defectos ~ arriba de T.Hi
				const double Noise = FMath::Abs(Rng.Gauss()) * T.Lo / 4.0 * (AlgoOK(*C) ? 1.0 : 3.0);
				if (Noise > T.K && !(C == DC && Defect && Defect->ParamK == P.K))
				{
					R.Falses++;
					R.NG.Add(C->Ref, TEXT("falso"));
				}
			}
			if (C == DC && Defect)
			{
				const FSwParam* P = nullptr;
				for (const FSwParam& Q : Def.Params) { if (Q.K == Defect->ParamK) { P = &Q; break; } }
				if (P)
				{
					const FNorm T = TNorm(*P);
					const double Sev = T.Hi + (1.0 - T.Hi) * Rng.Next() * 0.9 + 0.02;
					const bool bTypeOK = Defect->Algo.IsEmpty() || AlgoOK(*C);
					if (Sev > T.K && bTypeOK)
					{
						bRealCaught = true; R.Caught++;
						R.NG.Add(C->Ref, Defect->Name);
					}
					else
					{
						R.Escapes++;
						R.Rows.Add(TPair<FString, bool>(FString::Printf(TEXT("Tarjeta %d: ESCAPE %s en %s"), i + 1, *Defect->Name, *C->Ref), true));
					}
				}
			}
		}
		if (bRealCaught && DC && Defect)
		{
			R.Rows.Add(TPair<FString, bool>(FString::Printf(TEXT("Tarjeta %d: NG real %s en %s"), i + 1, *Defect->Name, *DC->Ref), false));
		}
	}
	return R;
}

// ------------------------------------------------------------------------------------------------
// Correr lote
// ------------------------------------------------------------------------------------------------
void SMachineSoftware::StartRun()
{
	if (bRunning || !Board.IsValid()) { return; }
	UAcademiaGameInstance* G = GI();
	RunResult = Simulate(50, FDateTime::UtcNow().GetMillisecond());
	RunDone = 0; bRunning = true; bHasRun = false; bReleased = false; Tips.Empty();
	NG.Empty();
	RefreshMarkers();
	RebuildTree();
	LogInfo(Theme.bXray ? TEXT("X-RAY ON: corriendo lote de 50 tarjetas.") : TEXT("Corriendo lote de 50 tarjetas."));
	if (G) { G->Sfx(Theme.bXray ? EAcademiaSfx::Xray : EAcademiaSfx::Conveyor); }
	RegisterActiveTimer(0.12f, FWidgetActiveTimerDelegate::CreateSP(this, &SMachineSoftware::OnRunTimer));
	RebuildPanel();
}

EActiveTimerReturnType SMachineSoftware::OnRunTimer(double InCurrentTime, float InDeltaTime)
{
	RunDone = FMath::Min(50, RunDone + 5);
	if (RunDone >= 50)
	{
		FinishRun();
		return EActiveTimerReturnType::Stop;
	}
	return EActiveTimerReturnType::Continue;
}

void SMachineSoftware::FinishRun()
{
	bRunning = false; bHasRun = true;
	NG = RunResult.NG;
	UAcademiaGameInstance* G = GI();
	int32 Count = 0;
	for (const TPair<FString, bool>& Row : RunResult.Rows)
	{
		if (Count++ >= 30) { break; }
		AddLog(Row.Key, Row.Value ? AcademiaUI::Bad : AcademiaUI::Good);
	}
	const bool bGood = RunResult.Escapes == 0 && RunResult.Falses <= 3;
	AddLog(FString::Printf(TEXT("Resultado: %d defectos detectados, %d falsos llamados, %d escapes."), RunResult.Caught, RunResult.Falses, RunResult.Escapes), bGood ? AcademiaUI::Good : AcademiaUI::Warn);
	Tips.Empty();
	if (bGood)
	{
		bReleased = true;
		LogOk(TEXT("Programa liberado a producción."));
		if (G) { G->Sfx(EAcademiaSfx::Badge); G->RecordProgramReleased(Mode); }
		if (const TSharedPtr<SAcademiaShell> S = Shell.Pin()) { S->Celebrate(); }
	}
	else
	{
		if (G) { G->Sfx(EAcademiaSfx::Bad); }
		if (RunResult.Escapes > 0) { Tips.Add(TEXT("Hay escapes: revisa que cada encapsulado tenga el algoritmo correcto y afloja menos los umbrales.")); }
		if (RunResult.Falses > 3) { Tips.Add(TEXT("Demasiados falsos llamados: el umbral está muy estricto o el algoritmo no corresponde.")); }
	}
	RefreshMarkers();
	RebuildTree();
	RebuildPanel();
}

TSharedRef<SWidget> SMachineSoftware::BuildPanelRun()
{
	TSharedRef<SVerticalBox> Result = SNew(SVerticalBox);
	auto Counter = [this](const FString& Label, FLinearColor Color, TFunction<int32()> Value) -> TSharedRef<SWidget>
	{
		return SNew(SVerticalBox)
			+ SVerticalBox::Slot().AutoHeight() [ Txt(Label, 10, Theme.Muted) ]
			+ SVerticalBox::Slot().AutoHeight() [ SNew(STextBlock).Font(AcademiaUI::Font(20, true)).ColorAndOpacity(Color).Text_Lambda([Value]() { return Tx(FString::FromInt(Value())); }) ];
	};
	auto Scaled = [this](int32 Total) { return FMath::RoundToInt((float)Total * (float)RunDone / 50.f); };

	if (bHasRun)
	{
		if (bReleased)
		{
			Result->AddSlot().AutoHeight().Padding(0, 6)
			[ AcademiaUI::Callout(FString::Printf(TEXT("Programa liberado a producción. Cero escapes y %d falsos llamados: tu programa %s está listo."), RunResult.Falses, *Def.Name), AcademiaUI::Good) ];
		}
		else
		{
			Result->AddSlot().AutoHeight().Padding(0, 6) [ AcademiaUI::Callout(TEXT("Todavía no. ") + FString::Join(Tips, TEXT(" ")), AcademiaUI::Warn) ];
		}
		Result->AddSlot().AutoHeight() [ Txt(TEXT("Marcas en la tarjeta: ámbar = falso llamado, rojo = defecto real."), 10, Theme.Muted) ];
	}
	return SNew(SVerticalBox)
		+ SVerticalBox::Slot().AutoHeight() [ Txt(TEXT("5. Inspeccionar lote"), 15, Theme.Text, true) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
		[ Txt(TEXT("Corre el programa sobre 50 tarjetas de producción con defectos reales mezclados. Para liberarlo: cero escapes y máximo 3 falsos llamados."), 11, Theme.Muted) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 6)
		[ Btn(bRunning ? TEXT("Corriendo...") : TEXT("▶ Correr 50 tarjetas"), [this]() { StartRun(); }, true, [this]() { return !bRunning; }, 13) ]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 4)
		[
			SNew(SBox).HeightOverride(8.f)
			[
				SNew(SProgressBar).FillColorAndOpacity(Theme.Accent)
				.Percent_Lambda([this]() -> TOptional<float> { return (float)RunDone / 50.f; })
			]
		]
		+ SVerticalBox::Slot().AutoHeight().Padding(0, 6)
		[
			SNew(SHorizontalBox)
			+ SHorizontalBox::Slot().FillWidth(1.f) [ Counter(TEXT("Tarjetas"), Theme.Text, [this]() { return RunDone; }) ]
			+ SHorizontalBox::Slot().FillWidth(1.f) [ Counter(TEXT("NG reales"), AcademiaUI::Good, [this, Scaled]() { return Scaled(RunResult.Caught); }) ]
			+ SHorizontalBox::Slot().FillWidth(1.f) [ Counter(TEXT("Falsos"), AcademiaUI::Warn, [this, Scaled]() { return Scaled(RunResult.Falses); }) ]
			+ SHorizontalBox::Slot().FillWidth(1.f) [ Counter(TEXT("Escapes"), AcademiaUI::Bad, [this, Scaled]() { return Scaled(RunResult.Escapes); }) ]
		]
		+ SVerticalBox::Slot().AutoHeight() [ Result ];
}

// ------------------------------------------------------------------------------------------------
// ICT: testplan generado y línea de comandos
// ------------------------------------------------------------------------------------------------
FString SMachineSoftware::BuildPlanText() const
{
	if (!Board.IsValid()) { return TEXT("! Sin tarjeta cargada.\n! Escribe 'load board' en la línea de comandos o usa File > Load Board.\n"); }
	const float Tol = ParamVals.FindRef(TEXT("tol"));
	const float Short = ParamVals.FindRef(TEXT("short"));

	// Nodos de cada componente (de IPC-D-356), ordenados por pin
	auto NodesOf = [this](const FString& Ref) -> FString
	{
		TMap<FString, FString> ByPin;
		for (const FNetPoint& N : Board->Nets) { if (N.Ref == Ref && !N.Net.IsEmpty()) { ByPin.Add(N.Pin, N.Net); } }
		FString Out;
		for (const FString Pin : { TEXT("1"), TEXT("2") })
		{
			if (const FString* N = ByPin.Find(Pin)) { Out += FString::Printf(TEXT("%s\"%s\""), Out.IsEmpty() ? TEXT("") : TEXT(", "), **N); }
		}
		return Out;
	};

	FString O;
	O += TEXT("! Keysight i3070 - testplan (simplificado, estilo BT-Basic)\n");
	O += FString::Printf(TEXT("! Tarjeta: %s\n"), *Board->Name);
	O += TEXT("! Solo lectura: se genera desde la tarjeta cargada y los umbrales.\n\n");
	O += FString::Printf(TEXT("board \"%s\"\n\n"), *Board->Id);

	// Cortos
	TArray<FString> Nets;
	for (const FNetPoint& N : Board->Nets) { if (!N.Net.IsEmpty()) { Nets.AddUnique(N.Net); } }
	O += TEXT("! ---------------- SHORTS ----------------\nunpowered\nshorts \"shorts\"\n");
	O += FString::Printf(TEXT("  threshold %.0f ohms\n  settling delay 0.01\n"), Short);
	for (int32 i = 0; i < Nets.Num(); i += 6)
	{
		FString L;
		for (int32 j = i; j < FMath::Min(i + 6, Nets.Num()); ++j) { L += FString::Printf(TEXT("%s\"%s\""), j > i ? TEXT(", ") : TEXT(""), *Nets[j]); }
		O += TEXT("  nodes ") + L + TEXT("\n");
	}
	if (Nets.Num() == 0) { O += TEXT("  ! sin netlist IPC-D-356: se probarían todos los nodos de la fixture\n"); }

	// Resistores
	O += TEXT("\n! ---------------- RESISTORES (nominal, tolerancia %) ----------------\n");
	for (const FBoardComponent& C : Board->Comps)
	{
		if (!C.Ref.StartsWith(TEXT("R"))) { continue; }
		O += FString::Printf(TEXT("test \"%s\"   ! %s\n  resistor %s, %.1f\n"), *C.Ref, *C.Package, *PlanValue(C.Value, true), Tol);
		const FString Nodes = NodesOf(C.Ref);
		if (!Nodes.IsEmpty()) { O += TEXT("  connect ") + Nodes + TEXT("\n"); }
	}
	// Capacitores
	O += TEXT("\n! ---------------- CAPACITORES ----------------\n");
	for (const FBoardComponent& C : Board->Comps)
	{
		if (!C.Ref.StartsWith(TEXT("C")) || C.Ref.StartsWith(TEXT("CON"))) { continue; }
		O += FString::Printf(TEXT("test \"%s\"   ! %s\n  capacitor %s, %.1f\n"), *C.Ref, *C.Package, *PlanValue(C.Value, false), Tol);
		const FString Nodes = NodesOf(C.Ref);
		if (!Nodes.IsEmpty()) { O += TEXT("  connect ") + Nodes + TEXT("\n"); }
	}
	// Diodos y transistores
	O += TEXT("\n! ---------------- DIODOS / TRANSISTORES ----------------\n");
	for (const FBoardComponent& C : Board->Comps)
	{
		if (C.Ref.StartsWith(TEXT("D"))) { O += FString::Printf(TEXT("test \"%s\"   ! %s %s\n  diode forward 0.4, 0.9\n"), *C.Ref, *C.Value, *C.Package); }
		else if (C.Ref.StartsWith(TEXT("Q"))) { O += FString::Printf(TEXT("test \"%s\"   ! %s %s\n  fet\n"), *C.Ref, *C.Value, *C.Package); }
	}
	// Boundary scan en los BGA
	O += TEXT("\n! ---------------- BOUNDARY SCAN ----------------\n");
	FString Tap;
	for (const FBoardComponent& C : Board->Comps) { if (C.Ref.StartsWith(TEXT("TP"))) { Tap += (Tap.IsEmpty() ? TEXT("") : TEXT(" ")) + C.Ref; } }
	bool bAnyBga = false;
	for (const FBoardComponent& C : Board->Comps)
	{
		if (Board->AlgoOf(C.Package) != TEXT("BGA")) { continue; }
		bAnyBga = true;
		O += FString::Printf(TEXT("powered\nboundary scan \"%s\"\n  device \"%s\"   ! %s\n  chain 1\n  interconnect test\n  cell test\n"), *C.Ref, *C.Ref, *C.Package);
		if (!Tap.IsEmpty()) { O += FString::Printf(TEXT("  ! puntos TAP disponibles: %s\n"), *Tap); }
	}
	if (!bAnyBga) { O += TEXT("! (esta tarjeta no tiene BGA)\n"); }
	O += TEXT("\nend testplan\n");
	return O;
}

void SMachineSoftware::RunCommand(const FString& CmdIn)
{
	const FString Cmd = CmdIn.TrimStartAndEnd().ToLower();
	if (Cmd.IsEmpty()) { return; }
	AddLog(TEXT("BT-Basic> ") + CmdIn, Theme.Accent);
	if (Cmd == TEXT("load board") || Cmd == TEXT("load"))
	{
		ImportDefault();
	}
	else if (Cmd == TEXT("run") || Cmd == TEXT("run board"))
	{
		if (!Board.IsValid()) { LogErr(TEXT("No hay tarjeta cargada. Usa: load board")); return; }
		if (Fids.Num() < RequiredFids() || !bLibChecked) { /* se permite correr; solo se avisa */ LogWarn(TEXT("Aviso: el programa no está completo (fiduciales/librería).")); }
		if (Fids.Num() < RequiredFids()) { SetTab(1); return; }
		SetTab(4);
		StartRun();
	}
	else if (Cmd == TEXT("debug"))
	{
		if (!Board.IsValid()) { LogErr(TEXT("No hay tarjeta cargada. Usa: load board")); return; }
		int32 Tests = 0;
		for (const FBoardComponent& C : Board->Comps) { if (!IsFidOrTp(C.Ref)) { ++Tests; } }
		LogInfo(FString::Printf(TEXT("debug: %d pruebas en el testplan, %d redes. Ajusta tolerancia y umbral de cortos en 4. Umbrales; falsos/escapes estimados: %d/%d."), Tests, Board->Nets.Num(), EstF, EstE));
	}
	else
	{
		LogInfo(TEXT("Comandos: load board | run | debug | help"));
	}
}

#undef LOCTEXT_NAMESPACE
