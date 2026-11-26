#include "AcademiaGerber.h"

#include <initializer_list>
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Misc/DefaultValueHelper.h"
#include "Dom/JsonObject.h"
#include "Dom/JsonValue.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

const FBoardComponent* FLoadedBoard::FindComp(const FString& Ref) const
{
	for (const FBoardComponent& C : Comps)
	{
		if (C.Ref == Ref) { return &C; }
	}
	return nullptr;
}

FString FLoadedBoard::AlgoOf(const FString& Package) const
{
	const FBoardPackage* P = Packages.Find(Package);
	if (P && !P->Algo.IsEmpty()) { return P->Algo; }
	return TEXT("CR");
}

namespace
{
	struct FAperture
	{
		FString Type;
		TArray<float> P;
	};

	bool IsNumChar(TCHAR C)
	{
		return (C >= TEXT('0') && C <= TEXT('9')) || C == TEXT('+') || C == TEXT('-') || C == TEXT('.');
	}

	// Lee un numero con signo/decimal desde Str[Idx]; avanza Idx.
	FString ReadNumToken(const FString& Str, int32& Idx)
	{
		const int32 Start = Idx;
		while (Idx < Str.Len() && IsNumChar(Str[Idx])) { ++Idx; }
		return Str.Mid(Start, Idx - Start);
	}

	double GerberNum(const FString& S, int32 Dec, double Scale)
	{
		if (S.Contains(TEXT("."))) { return FCString::Atod(*S) * Scale; }
		return (double)FCString::Atoi64(*S) / FMath::Pow(10.0, (double)Dec) * Scale;
	}

	void ExpandBounds(FBox2D& B, const FVector2D& P)
	{
		B += P;
	}

	void ProcessExtended(const FString& Block, FGerberLayer& Out, int32& XDec, int32& YDec, double& Scale, TMap<int32, FAperture>& Aps)
	{
		TArray<FString> Cmds;
		Block.ParseIntoArray(Cmds, TEXT("*"), true);
		for (FString Cmd : Cmds)
		{
			Cmd.TrimStartAndEndInline();
			Cmd.ReplaceInline(TEXT("\n"), TEXT(""));
			if (Cmd.StartsWith(TEXT("FS")))
			{
				const int32 XI = Cmd.Find(TEXT("X"));
				const int32 YI = Cmd.Find(TEXT("Y"));
				if (XI != INDEX_NONE && YI != INDEX_NONE && XI + 2 < Cmd.Len() && YI + 2 < Cmd.Len())
				{
					XDec = Cmd[XI + 2] - TEXT('0');
					YDec = Cmd[YI + 2] - TEXT('0');
				}
			}
			else if (Cmd.StartsWith(TEXT("MO")))
			{
				Out.bInches = Cmd.Contains(TEXT("IN"));
				Scale = Out.bInches ? 25.4 : 1.0;
			}
			else if (Cmd.StartsWith(TEXT("ADD")))
			{
				int32 I = 3;
				const int32 NumStart = I;
				while (I < Cmd.Len() && FChar::IsDigit(Cmd[I])) { ++I; }
				if (I == NumStart) { continue; }
				const int32 Code = FCString::Atoi(*Cmd.Mid(NumStart, I - NumStart));
				const int32 Comma = Cmd.Find(TEXT(","), ESearchCase::IgnoreCase, ESearchDir::FromStart, I);
				FAperture Ap;
				FString Params;
				if (Comma == INDEX_NONE) { Ap.Type = Cmd.Mid(I); }
				else { Ap.Type = Cmd.Mid(I, Comma - I); Params = Cmd.Mid(Comma + 1); }
				if (!Params.IsEmpty())
				{
					TArray<FString> Parts;
					Params.ParseIntoArray(Parts, TEXT("X"), true);
					for (const FString& Part : Parts) { Ap.P.Add((float)(FCString::Atod(*Part) * Scale)); }
				}
				if (Ap.P.Num() == 0) { Ap.P.Add((float)(0.2 * Scale)); }
				Aps.Add(Code, Ap);
			}
		}
	}
}

namespace AcademiaGerber
{
	FGerberLayer ParseGerber(const FString& Text)
	{
		FGerberLayer Out;
		int32 XDec = 4, YDec = 4;
		double Scale = 1.0;
		TMap<int32, FAperture> Aps;
		const FAperture* Cur = nullptr;
		double X = 0, Y = 0;
		bool bInRegion = false;
		TArray<FVector2D> Region;

		const int32 N = Text.Len();
		int32 I = 0;
		FString Cmd;
		while (I < N)
		{
			const TCHAR C = Text[I];
			if (C == TEXT('%'))
			{
				const int32 End = Text.Find(TEXT("%"), ESearchCase::CaseSensitive, ESearchDir::FromStart, I + 1);
				if (End == INDEX_NONE) { Out.Errors.Add(TEXT("Bloque % sin cerrar")); break; }
				ProcessExtended(Text.Mid(I + 1, End - I - 1), Out, XDec, YDec, Scale, Aps);
				I = End + 1;
				continue;
			}
			if (C != TEXT('*'))
			{
				if (C != TEXT('\n') && C != TEXT('\r')) { Cmd.AppendChar(C); }
				++I;
				continue;
			}
			++I;
			FString S = Cmd.TrimStartAndEnd();
			Cmd.Reset();
			if (S.IsEmpty() || S.StartsWith(TEXT("G04"))) { continue; }
			if (S == TEXT("G36")) { bInRegion = true; Region.Reset(); continue; }
			if (S == TEXT("G37"))
			{
				if (bInRegion && Region.Num() > 2) { Out.Regions.Add(Region); }
				bInRegion = false; Region.Reset();
				continue;
			}
			if (S.StartsWith(TEXT("M02"))) { break; }

			// Tokeniza letra+numero
			bool bHasX = false, bHasY = false;
			FString XS, YS;
			int32 D = -1;
			int32 P = 0;
			while (P < S.Len())
			{
				const TCHAR L = S[P++];
				if (!FChar::IsAlpha(L)) { continue; }
				const FString Num = ReadNumToken(S, P);
				const TCHAR U = FChar::ToUpper(L);
				if (U == TEXT('X')) { bHasX = true; XS = Num; }
				else if (U == TEXT('Y')) { bHasY = true; YS = Num; }
				else if (U == TEXT('D')) { D = FCString::Atoi(*Num); }
			}
			if (D >= 10 && !bHasX && !bHasY)
			{
				Cur = Aps.Find(D);
				continue;
			}
			if (D < 1 || D > 3) { continue; }

			const double NX = bHasX ? GerberNum(XS, XDec, Scale) : X;
			const double NY = bHasY ? GerberNum(YS, YDec, Scale) : Y;
			if (D == 1)
			{
				if (bInRegion)
				{
					if (Region.Num() == 0) { Region.Add(FVector2D(X, Y)); }
					Region.Add(FVector2D(NX, NY));
				}
				else
				{
					FGerberLine L;
					L.A = FVector2D(X, Y);
					L.B = FVector2D(NX, NY);
					L.Width = (Cur && Cur->P.Num() > 0) ? Cur->P[0] : 0.15f;
					Out.Lines.Add(L);
				}
			}
			else if (D == 2)
			{
				if (bInRegion)
				{
					if (Region.Num() > 2) { Out.Regions.Add(Region); }
					Region.Reset();
				}
			}
			else if (D == 3 && Cur)
			{
				FGerberFlash F;
				F.Pos = FVector2D(NX, NY);
				F.Shape = Cur->Type;
				F.W = Cur->P.Num() > 0 ? Cur->P[0] : 0.f;
				F.H = Cur->P.Num() > 1 ? Cur->P[1] : F.W;
				Out.Flashes.Add(F);
			}
			X = NX; Y = NY;
		}

		for (const FGerberFlash& F : Out.Flashes)
		{
			ExpandBounds(Out.Bounds, F.Pos - FVector2D(F.W * 0.5f, F.H * 0.5f));
			ExpandBounds(Out.Bounds, F.Pos + FVector2D(F.W * 0.5f, F.H * 0.5f));
		}
		for (const FGerberLine& L : Out.Lines) { ExpandBounds(Out.Bounds, L.A); ExpandBounds(Out.Bounds, L.B); }
		for (const TArray<FVector2D>& R : Out.Regions) { for (const FVector2D& V : R) { ExpandBounds(Out.Bounds, V); } }
		return Out;
	}

	TArray<FDrillHole> ParseExcellon(const FString& Text)
	{
		TArray<FDrillHole> Holes;
		TMap<int32, float> Tools;
		int32 Cur = -1;
		bool bMetric = true;
		TArray<FString> Lines;
		Text.ParseIntoArrayLines(Lines, false);
		for (const FString& Ln : Lines)
		{
			const FString S = Ln.TrimStartAndEnd();
			if (S.StartsWith(TEXT("INCH"))) { bMetric = false; }
			if (S.StartsWith(TEXT("METRIC"))) { bMetric = true; }
			const double K = bMetric ? 1.0 : 25.4;
			if (S.StartsWith(TEXT("T")) && S.Len() > 1 && FChar::IsDigit(S[1]))
			{
				int32 P = 1;
				const int32 Start = P;
				while (P < S.Len() && FChar::IsDigit(S[P])) { ++P; }
				const int32 Tool = FCString::Atoi(*S.Mid(Start, P - Start));
				if (P < S.Len() && S[P] == TEXT('C'))
				{
					++P;
					const FString Num = ReadNumToken(S, P);
					Tools.Add(Tool, (float)(FCString::Atod(*Num) * K));
				}
				else if (P == S.Len()) { Cur = Tool; }
				continue;
			}
			if (S.StartsWith(TEXT("X")) && Cur >= 0)
			{
				int32 P = 1;
				const FString XS = ReadNumToken(S, P);
				if (P < S.Len() && S[P] == TEXT('Y'))
				{
					++P;
					const FString YS = ReadNumToken(S, P);
					FDrillHole H;
					H.Pos = FVector2D(FCString::Atod(*XS) * K, FCString::Atod(*YS) * K);
					const float* D = Tools.Find(Cur);
					H.Diameter = (D && *D > 0.f) ? *D : 0.8f;
					Holes.Add(H);
				}
			}
		}
		return Holes;
	}

	TArray<TArray<FString>> ParseCSV(const FString& Text)
	{
		TArray<TArray<FString>> Rows;
		TArray<FString> Row;
		FString Cell;
		bool bQuote = false;
		const int32 N = Text.Len();
		for (int32 I = 0; I < N; ++I)
		{
			const TCHAR C = Text[I];
			if (bQuote)
			{
				if (C == TEXT('"') && I + 1 < N && Text[I + 1] == TEXT('"')) { Cell.AppendChar(TEXT('"')); ++I; }
				else if (C == TEXT('"')) { bQuote = false; }
				else { Cell.AppendChar(C); }
			}
			else if (C == TEXT('"')) { bQuote = true; }
			else if (C == TEXT(',')) { Row.Add(Cell); Cell.Reset(); }
			else if (C == TEXT('\n') || C == TEXT('\r'))
			{
				if (C == TEXT('\r') && I + 1 < N && Text[I + 1] == TEXT('\n')) { ++I; }
				Row.Add(Cell);
				bool bAny = false;
				for (const FString& V : Row) { if (!V.IsEmpty()) { bAny = true; break; } }
				if (bAny) { Rows.Add(Row); }
				Row.Reset(); Cell.Reset();
			}
			else { Cell.AppendChar(C); }
		}
		if (!Cell.IsEmpty() || Row.Num() > 0) { Row.Add(Cell); Rows.Add(Row); }
		for (TArray<FString>& R : Rows) { for (FString& V : R) { V.TrimStartAndEndInline(); } }
		return Rows;
	}

	TArray<FBoardComponent> ParseCentroid(const FString& Text)
	{
		TArray<FBoardComponent> Out;
		TArray<TArray<FString>> Rows = ParseCSV(Text);
		if (Rows.Num() < 2) { return Out; }
		const TArray<FString>& Head = Rows[0];

		// Busca la primera columna cuyo encabezado cumpla el predicado
		auto Find = [&Head](TFunctionRef<bool(const FString&)> Pred) -> int32
		{
			for (int32 I = 0; I < Head.Num(); ++I) { if (Pred(Head[I])) { return I; } }
			return INDEX_NONE;
		};
		auto StartsAny = [](const FString& H, std::initializer_list<const TCHAR*> Prefixes) -> bool
		{
			for (const TCHAR* P : Prefixes) { if (H.StartsWith(P, ESearchCase::IgnoreCase)) { return true; } }
			return false;
		};
		const int32 CRef = Find([&](const FString& H) { return StartsAny(H, { TEXT("designator"), TEXT("ref") }); });
		const int32 CVal = Find([&](const FString& H) { return StartsAny(H, { TEXT("value"), TEXT("val"), TEXT("comment") }); });
		const int32 CPkg = Find([&](const FString& H) { return StartsAny(H, { TEXT("package"), TEXT("footprint") }); });
		const int32 CX = Find([&](const FString& H) { return H.Contains(TEXT("mid x"), ESearchCase::IgnoreCase) || H.Contains(TEXT("midx"), ESearchCase::IgnoreCase) || H.Contains(TEXT("posx"), ESearchCase::IgnoreCase) || H.StartsWith(TEXT("x"), ESearchCase::IgnoreCase); });
		const int32 CY = Find([&](const FString& H) { return H.Contains(TEXT("mid y"), ESearchCase::IgnoreCase) || H.Contains(TEXT("midy"), ESearchCase::IgnoreCase) || H.Contains(TEXT("posy"), ESearchCase::IgnoreCase) || H.StartsWith(TEXT("y"), ESearchCase::IgnoreCase); });
		const int32 CRot = Find([&](const FString& H) { return StartsAny(H, { TEXT("rot") }); });
		const int32 CLay = Find([&](const FString& H) { return StartsAny(H, { TEXT("layer"), TEXT("side") }); });
		if (CRef == INDEX_NONE || CX == INDEX_NONE || CY == INDEX_NONE) { return Out; }

		auto Cell = [](const TArray<FString>& R, int32 Idx) -> FString { return (Idx != INDEX_NONE && R.IsValidIndex(Idx)) ? R[Idx] : FString(); };
		for (int32 RI = 1; RI < Rows.Num(); ++RI)
		{
			const TArray<FString>& R = Rows[RI];
			FBoardComponent C;
			C.Ref = Cell(R, CRef);
			const FString XS = Cell(R, CX), YS = Cell(R, CY);
			if (C.Ref.IsEmpty() || XS.IsEmpty() || !XS.IsNumeric()) { continue; }
			C.Value = Cell(R, CVal);
			C.Package = Cell(R, CPkg);
			C.Pos = FVector2D(FCString::Atod(*XS), YS.IsNumeric() ? FCString::Atod(*YS) : 0.0);
			const FString RS = Cell(R, CRot);
			C.Rotation = RS.IsNumeric() ? (float)FCString::Atod(*RS) : 0.f;
			C.Layer = Cell(R, CLay);
			if (C.Layer.IsEmpty()) { C.Layer = TEXT("Top"); }
			Out.Add(C);
		}
		return Out;
	}

	TArray<FNetPoint> ParseIPC356(const FString& Text)
	{
		TArray<FNetPoint> Pts;
		TArray<FString> Lines;
		Text.ParseIntoArrayLines(Lines, false);
		for (const FString& Ln : Lines)
		{
			if (!Ln.StartsWith(TEXT("317"))) { continue; }
			FNetPoint P;
			P.Net = Ln.Mid(3, 14).TrimStartAndEnd();
			P.Ref = Ln.Mid(20, 6).TrimStartAndEnd();
			P.Pin = Ln.Mid(27, 4).TrimStartAndEnd();
			// Primer X[+-]digitos Y[+-]digitos
			bool bFound = false;
			for (int32 I = 0; I + 1 < Ln.Len() && !bFound; ++I)
			{
				if (Ln[I] != TEXT('X') || (Ln[I + 1] != TEXT('+') && Ln[I + 1] != TEXT('-'))) { continue; }
				int32 J = I + 2;
				while (J < Ln.Len() && FChar::IsDigit(Ln[J])) { ++J; }
				if (J == I + 2 || J + 1 >= Ln.Len() || Ln[J] != TEXT('Y') || (Ln[J + 1] != TEXT('+') && Ln[J + 1] != TEXT('-'))) { continue; }
				int32 K = J + 2;
				while (K < Ln.Len() && FChar::IsDigit(Ln[K])) { ++K; }
				if (K == J + 2) { continue; }
				P.Pos = FVector2D(FCString::Atoi64(*Ln.Mid(I + 1, J - I - 1)) / 1000.0, FCString::Atoi64(*Ln.Mid(J + 1, K - J - 1)) / 1000.0);
				bFound = true;
			}
			if (!bFound) { continue; }
			P.bTestPoint = P.Ref.StartsWith(TEXT("TP"), ESearchCase::IgnoreCase);
			Pts.Add(P);
		}
		return Pts;
	}
}

namespace
{
	// Lee un archivo; si falta agrega advertencia y devuelve false
	bool ReadFile(const FString& Path, FString& OutText, FLoadedBoard& B)
	{
		if (!FFileHelper::LoadFileToString(OutText, *Path))
		{
			B.Warnings.Add(FString::Printf(TEXT("No se pudo leer %s"), *Path));
			return false;
		}
		return true;
	}

	void FinishSize(FLoadedBoard& B)
	{
		if (B.Width <= 0.f || B.Height <= 0.f)
		{
			const FGerberLayer* Src = B.Outline.Bounds.bIsValid ? &B.Outline : (B.Copper.Bounds.bIsValid ? &B.Copper : nullptr);
			if (Src)
			{
				const bool bOutline = (Src == &B.Outline);
				B.Width = bOutline ? (float)Src->Bounds.GetSize().X : (float)Src->Bounds.Max.X;
				B.Height = bOutline ? (float)Src->Bounds.GetSize().Y : (float)Src->Bounds.Max.Y;
			}
		}
	}
}

namespace AcademiaGerber
{
	bool LoadBoardFromDir(const FString& BoardDir, FLoadedBoard& Out)
	{
		Out = FLoadedBoard();
		FString JsonText;
		const FString JsonPath = FPaths::Combine(BoardDir, TEXT("board.json"));
		if (!FFileHelper::LoadFileToString(JsonText, *JsonPath))
		{
			Out.Warnings.Add(FString::Printf(TEXT("No existe %s"), *JsonPath));
			return false;
		}
		TSharedPtr<FJsonObject> Root;
		TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonText);
		if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
		{
			Out.Warnings.Add(TEXT("board.json no es JSON valido"));
			return false;
		}
		Root->TryGetStringField(TEXT("id"), Out.Id);
		Root->TryGetStringField(TEXT("name"), Out.Name);
		Root->TryGetStringField(TEXT("description"), Out.Description);
		double Num = 0;
		if (Root->TryGetNumberField(TEXT("width"), Num)) { Out.Width = (float)Num; }
		if (Root->TryGetNumberField(TEXT("height"), Num)) { Out.Height = (float)Num; }
		if (Root->TryGetNumberField(TEXT("thickness"), Num)) { Out.Thickness = (float)Num; }

		const TSharedPtr<FJsonObject>* Pkgs = nullptr;
		if (Root->TryGetObjectField(TEXT("packages"), Pkgs) && Pkgs)
		{
			for (const TPair<FString, TSharedPtr<FJsonValue>>& KV : (*Pkgs)->Values)
			{
				const TSharedPtr<FJsonObject>* PO = nullptr;
				if (!KV.Value.IsValid() || !KV.Value->TryGetObject(PO) || !PO) { continue; }
				FBoardPackage BP;
				(*PO)->TryGetStringField(TEXT("algo"), BP.Algo);
				double H = 0;
				if ((*PO)->TryGetNumberField(TEXT("height"), H)) { BP.Height = (float)H; }
				const TArray<TSharedPtr<FJsonValue>>* Body = nullptr;
				if ((*PO)->TryGetArrayField(TEXT("body"), Body) && Body && Body->Num() >= 2)
				{
					BP.Body = FVector2D((*Body)[0]->AsNumber(), (*Body)[1]->AsNumber());
				}
				Out.Packages.Add(KV.Key, BP);
			}
		}

		const TSharedPtr<FJsonObject>* Files = nullptr;
		if (!Root->TryGetObjectField(TEXT("files"), Files) || !Files)
		{
			Out.Warnings.Add(TEXT("board.json no tiene mapa 'files'"));
			FinishSize(Out);
			return true;
		}
		auto Load = [&](const TCHAR* Key, FString& Text) -> bool
		{
			FString Name;
			if (!(*Files)->TryGetStringField(Key, Name) || Name.IsEmpty()) { return false; }
			return ReadFile(FPaths::Combine(BoardDir, Name), Text, Out);
		};
		FString T;
		if (Load(TEXT("copper"), T)) { Out.Copper = AcademiaGerber::ParseGerber(T); }
		if (Load(TEXT("mask"), T)) { Out.Mask = AcademiaGerber::ParseGerber(T); }
		if (Load(TEXT("paste"), T)) { Out.Paste = AcademiaGerber::ParseGerber(T); }
		if (Load(TEXT("silk"), T)) { Out.Silk = AcademiaGerber::ParseGerber(T); }
		if (Load(TEXT("outline"), T)) { Out.Outline = AcademiaGerber::ParseGerber(T); }
		if (Load(TEXT("drill"), T)) { Out.Holes = AcademiaGerber::ParseExcellon(T); }
		if (Load(TEXT("centroid"), T)) { Out.Comps = AcademiaGerber::ParseCentroid(T); }
		if (Load(TEXT("netlist"), T)) { Out.Nets = AcademiaGerber::ParseIPC356(T); }
		// "bom" se ignora aqui: la UI de BOM la lee aparte.
		FinishSize(Out);
		return true;
	}

	bool LoadBoardFromFiles(const TArray<FString>& FilePaths, FLoadedBoard& Out)
	{
		Out = FLoadedBoard();
		Out.Id = TEXT("user");
		Out.Name = TEXT("Tarjeta del usuario");
		bool bAny = false;
		for (const FString& Path : FilePaths)
		{
			FString T;
			if (!ReadFile(Path, T, Out)) { continue; }
			const FString N = FPaths::GetCleanFilename(Path).ToLower();
			const FString Ext = FPaths::GetExtension(N).ToLower();
			const FString Head = T.Left(300);
			bAny = true;
			if (N.Contains(TEXT("bom"))) { continue; }
			if ((Ext == TEXT("csv") || Ext == TEXT("txt")) && (Head.Contains(TEXT("designator"), ESearchCase::IgnoreCase) || Head.Contains(TEXT("ref"), ESearchCase::IgnoreCase)))
			{
				Out.Comps = AcademiaGerber::ParseCentroid(T);
			}
			else if (Ext == TEXT("drl") || Ext == TEXT("xln") || Ext == TEXT("exc") || T.StartsWith(TEXT("M48")))
			{
				Out.Holes = AcademiaGerber::ParseExcellon(T);
			}
			else if (Ext == TEXT("ipc") || T.Contains(TEXT("\n317")) || T.StartsWith(TEXT("317")))
			{
				Out.Nets = AcademiaGerber::ParseIPC356(T);
			}
			else if (N.Contains(TEXT("paste")) || Ext == TEXT("gtp") || Ext == TEXT("gbp"))
			{
				Out.Paste = AcademiaGerber::ParseGerber(T);
			}
			else if (N.Contains(TEXT("silk")) || Ext == TEXT("gto"))
			{
				Out.Silk = AcademiaGerber::ParseGerber(T);
			}
			else if (N.Contains(TEXT("mask")) || Ext == TEXT("gts"))
			{
				Out.Mask = AcademiaGerber::ParseGerber(T);
			}
			else if (N.Contains(TEXT("edge")) || N.Contains(TEXT("outline")) || Ext == TEXT("gm1") || Ext == TEXT("gko"))
			{
				Out.Outline = AcademiaGerber::ParseGerber(T);
			}
			else if (Ext == TEXT("gtl") || Ext == TEXT("gbr") || T.Contains(TEXT("%FS")) || T.Contains(TEXT("D03")))
			{
				Out.Copper = AcademiaGerber::ParseGerber(T);
			}
			else
			{
				Out.Warnings.Add(FString::Printf(TEXT("Archivo no reconocido: %s"), *Path));
			}
		}
		FinishSize(Out);
		return bAny;
	}
}
