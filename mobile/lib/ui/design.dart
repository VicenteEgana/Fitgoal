import 'dart:math' as math;
import 'dart:ui' show FontFeature, lerpDouble;

import 'package:flutter/material.dart';

/// Sistema de diseño de FitGoal («Fresh Bio-Tech»): superficies oscuras con profundidad, acento esmeralda para la acción
/// y un color propio para cada tipo de dato (racha, proteínas, carbohidratos, grasas, descanso). El modo claro usa los
/// mismos papeles con tonos más oscuros, para mantener el contraste.

/// Desde este ancho la app usa la barra lateral en vez de la barra inferior.
const kShellBreakpoint = 768.0;

/// Desde este ancho de contenido las pantallas se ordenan en dos columnas.
const kBentoBreakpoint = 960.0;

/// Ancho máximo del contenido en escritorio (equivale a max-w-6xl).
const kContentMaxWidth = 1152.0;

/// Cifras con dígitos de igual ancho (kcal, IMC, días de racha), para que no «bailen» al cambiar.
const tabularFigures = [FontFeature.tabularFigures()];

class FitTokens extends ThemeExtension<FitTokens> {
  const FitTokens({
    required this.background,
    required this.card,
    required this.cardHigh,
    required this.border,
    required this.borderStrong,
    required this.muted,
    required this.accent,
    required this.heroGradient,
    required this.heroBorder,
    required this.streak,
    required this.protein,
    required this.carbs,
    required this.fat,
    required this.rest,
    required this.info,
    required this.danger,
    required this.glass,
  });

  final Color background;
  final Color card;
  final Color cardHigh;
  final Color border;
  final Color borderStrong;
  /// Texto secundario (subtítulos, descripciones).
  final Color muted;
  /// Esmeralda para texto e íconos activos sobre el fondo.
  final Color accent;
  final List<Color> heroGradient;
  final Color heroBorder;
  final Color streak;
  final Color protein;
  final Color carbs;
  final Color fat;
  final Color rest;
  final Color info;
  final Color danger;
  /// Fondo translúcido de la barra inferior.
  final Color glass;

  static const dark = FitTokens(
    background: Color(0xFF090D0C),
    card: Color(0xFF121716),
    cardHigh: Color(0xFF1A2120),
    border: Color(0x14FFFFFF),
    borderStrong: Color(0x29FFFFFF),
    muted: Color(0xFFA1A1AA),
    accent: Color(0xFF34D399),
    heroGradient: [Color(0xCC022C22), Color(0x66042F2E), Color(0xFF141A19)],
    heroBorder: Color(0x4D10B981),
    streak: Color(0xFFF59E0B),
    protein: Color(0xFF38BDF8),
    carbs: Color(0xFFFBBF24),
    fat: Color(0xFFF472B6),
    rest: Color(0xFF818CF8),
    info: Color(0xFF38BDF8),
    danger: Color(0xFFF87171),
    glass: Color(0xD909090B),
  );

  static const light = FitTokens(
    background: Color(0xFFF3F6F5),
    card: Color(0xFFFFFFFF),
    cardHigh: Color(0xFFECF2F0),
    border: Color(0x14000000),
    borderStrong: Color(0x26000000),
    muted: Color(0xFF52605B),
    accent: Color(0xFF047857),
    heroGradient: [Color(0xFFD1FAE5), Color(0xFFECFDF5), Color(0xFFFFFFFF)],
    heroBorder: Color(0x6610B981),
    streak: Color(0xFFD97706),
    protein: Color(0xFF0284C7),
    carbs: Color(0xFFB45309),
    fat: Color(0xFFDB2777),
    rest: Color(0xFF6366F1),
    info: Color(0xFF0369A1),
    danger: Color(0xFFDC2626),
    glass: Color(0xE6FFFFFF),
  );

  static FitTokens of(BuildContext context) =>
      Theme.of(context).extension<FitTokens>() ?? (Theme.of(context).brightness == Brightness.dark ? dark : light);

  @override
  FitTokens copyWith() => this;

  @override
  FitTokens lerp(FitTokens? other, double t) {
    if (other == null) return this;
    Color c(Color a, Color b) => Color.lerp(a, b, t)!;
    return FitTokens(
      background: c(background, other.background),
      card: c(card, other.card),
      cardHigh: c(cardHigh, other.cardHigh),
      border: c(border, other.border),
      borderStrong: c(borderStrong, other.borderStrong),
      muted: c(muted, other.muted),
      accent: c(accent, other.accent),
      heroGradient: [for (var i = 0; i < heroGradient.length; i++) c(heroGradient[i], other.heroGradient[i])],
      heroBorder: c(heroBorder, other.heroBorder),
      streak: c(streak, other.streak),
      protein: c(protein, other.protein),
      carbs: c(carbs, other.carbs),
      fat: c(fat, other.fat),
      rest: c(rest, other.rest),
      info: c(info, other.info),
      danger: c(danger, other.danger),
      glass: c(glass, other.glass),
    );
  }
}

/// Lista principal de una pantalla: centrada con un ancho máximo en escritorio, márgenes cómodos en el teléfono y espacio
/// al final para que la barra inferior no tape el último elemento.
class PageList extends StatelessWidget {
  const PageList({super.key, required this.children, this.maxWidth = kContentMaxWidth, this.controller});
  final List<Widget> children;
  final double maxWidth;
  final ScrollController? controller;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.paddingOf(context).bottom;
    return LayoutBuilder(
      builder: (context, constraints) {
        final wide = constraints.maxWidth >= kShellBreakpoint;
        final gutter = wide ? 32.0 : 16.0;
        final side = math.max(gutter, (constraints.maxWidth - maxWidth) / 2);
        return ListView(
          controller: controller,
          padding: EdgeInsets.fromLTRB(side, wide ? 8 : 4, side, (wide ? 40 : 24) + bottomInset),
          children: children,
        );
      },
    );
  }
}

/// Dos columnas en pantallas anchas (por defecto 7 + 5 de 12) y una sola columna en el teléfono, con su propio orden.
class BentoColumns extends StatelessWidget {
  const BentoColumns({super.key, required this.primary, required this.secondary, this.narrow, this.primaryFlex = 7, this.secondaryFlex = 5, this.breakpoint = kBentoBreakpoint});
  final List<Widget> primary;
  final List<Widget> secondary;
  /// Orden en una columna; si falta, primero la columna principal y después la secundaria.
  final List<Widget>? narrow;
  final int primaryFlex;
  final int secondaryFlex;
  final double breakpoint;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      if (constraints.maxWidth < breakpoint) {
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: narrow ?? [...primary, ...secondary]);
      }
      return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(flex: primaryFlex, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: primary)),
        const SizedBox(width: 20),
        Expanded(flex: secondaryFlex, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: secondary)),
      ]);
    });
  }
}

/// Grilla simple: en pantallas anchas reparte los elementos en `columns` columnas; en el teléfono, uno bajo el otro.
class ResponsiveGrid extends StatelessWidget {
  const ResponsiveGrid({super.key, required this.children, this.columns = 2, this.minItemWidth = 360, this.spacing = 16});
  final List<Widget> children;
  final int columns;
  final double minItemWidth;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final fit = ((constraints.maxWidth + spacing) / (minItemWidth + spacing)).floor().clamp(1, columns);
      if (fit <= 1) return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: children);
      final rows = <Widget>[];
      for (var start = 0; start < children.length; start += fit) {
        final slice = children.sublist(start, math.min(start + fit, children.length));
        rows.add(IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            for (var i = 0; i < fit; i++) ...[
              if (i > 0) SizedBox(width: spacing),
              Expanded(child: i < slice.length ? slice[i] : const SizedBox()),
            ],
          ]),
        ));
      }
      return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: rows);
    });
  }
}

/// Encabezado de una pantalla: título grande y una línea de contexto.
class PageHeader extends StatelessWidget {
  const PageHeader({super.key, required this.title, this.subtitle, this.trailing});
  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final text = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: text.headlineMedium?.copyWith(fontWeight: FontWeight.w800, letterSpacing: -0.8)),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(subtitle!, style: text.bodyMedium?.copyWith(color: tokens.muted)),
            ],
          ]),
        ),
        ?trailing,
      ]),
    );
  }
}

/// Tarjeta base: superficie con borde sutil y esquinas de 20 px. Si se toca, se eleva al pasar el mouse y se hunde
/// levemente al presionarla.
class FitCard extends StatefulWidget {
  const FitCard({super.key, required this.child, this.padding = const EdgeInsets.all(20), this.margin = const EdgeInsets.only(bottom: 16), this.onTap, this.hero = false, this.color, this.borderColor, this.inkKey});
  final Widget child;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final VoidCallback? onTap;
  /// Tarjeta destacada: degradado esmeralda con borde luminoso.
  final bool hero;
  final Color? color;
  final Color? borderColor;
  /// Clave del área que se toca, para las pruebas.
  final Key? inkKey;

  @override
  State<FitCard> createState() => _FitCardState();
}

class _FitCardState extends State<FitCard> {
  bool _hover = false;
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final dark = Theme.of(context).brightness == Brightness.dark;
    final radius = BorderRadius.circular(20);
    final interactive = widget.onTap != null;
    final borderColor = widget.borderColor ?? (widget.hero ? tokens.heroBorder : (_hover && interactive ? tokens.borderStrong : tokens.border));
    final decoration = BoxDecoration(
      color: widget.hero ? null : (widget.color ?? tokens.card),
      gradient: widget.hero ? LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: tokens.heroGradient) : null,
      borderRadius: radius,
      border: Border.all(color: borderColor),
      boxShadow: [
        if (widget.hero) BoxShadow(color: const Color(0xFF10B981).withValues(alpha: dark ? 0.10 : 0.12), blurRadius: 32, offset: const Offset(0, 12)),
        if (_hover && interactive) BoxShadow(color: Colors.black.withValues(alpha: dark ? 0.35 : 0.08), blurRadius: 24, offset: const Offset(0, 10)),
      ],
    );
    Widget content = Padding(padding: widget.padding, child: widget.child);
    if (interactive) {
      content = InkWell(
        key: widget.inkKey,
        borderRadius: radius,
        onTap: widget.onTap,
        onHover: (value) => setState(() => _hover = value),
        onHighlightChanged: (value) => setState(() => _pressed = value),
        child: content,
      );
    }
    return Padding(
      padding: widget.margin,
      child: AnimatedScale(
        scale: _pressed ? 0.99 : 1,
        duration: const Duration(milliseconds: 120),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          transform: Matrix4.translationValues(0, _hover && interactive ? -2 : 0, 0),
          decoration: decoration,
          child: Material(type: MaterialType.transparency, borderRadius: radius, clipBehavior: Clip.antiAlias, child: content),
        ),
      ),
    );
  }
}

/// Ícono dentro de un cuadrado redondeado con el color del dato.
class IconBadge extends StatelessWidget {
  const IconBadge(this.icon, {super.key, this.color, this.size = 40, this.iconSize});
  final IconData icon;
  final Color? color;
  final double size;
  final double? iconSize;

  @override
  Widget build(BuildContext context) {
    final base = color ?? FitTokens.of(context).accent;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: base.withValues(alpha: 0.14), borderRadius: BorderRadius.circular(size * 0.3), border: Border.all(color: base.withValues(alpha: 0.22))),
      child: Icon(icon, size: iconSize ?? size * 0.5, color: base),
    );
  }
}

/// Píldora con ícono opcional: atributos de una rutina, macros, estados.
class Pill extends StatelessWidget {
  const Pill(this.label, {super.key, this.icon, this.color, this.strong = false, this.textKey});
  final String label;
  final IconData? icon;
  final Color? color;
  final bool strong;
  final Key? textKey;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final base = color ?? tokens.muted;
    final neutral = color == null;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: neutral ? tokens.cardHigh : base.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: neutral ? tokens.border : base.withValues(alpha: 0.28)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 14, color: base), const SizedBox(width: 5)],
        Flexible(
          child: Text(
            label,
            key: textKey,
            style: TextStyle(fontSize: 12, height: 1.2, fontWeight: strong ? FontWeight.w700 : FontWeight.w600, color: neutral ? Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.85) : base),
          ),
        ),
      ]),
    );
  }
}

/// Aviso compacto con fondo tenue: ámbar para advertencias, azul para información.
class Callout extends StatelessWidget {
  const Callout({super.key, required this.child, this.icon = Icons.info_outline, this.color, this.margin = const EdgeInsets.only(top: 8)});
  final Widget child;
  final IconData icon;
  final Color? color;
  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final base = color ?? FitTokens.of(context).info;
    return Container(
      margin: margin,
      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
      decoration: BoxDecoration(color: base.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(12), border: Border.all(color: base.withValues(alpha: 0.25))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, size: 18, color: base)),
        const SizedBox(width: 10),
        Expanded(child: DefaultTextStyle.merge(style: const TextStyle(fontSize: 13, height: 1.35), child: child)),
      ]),
    );
  }
}

/// Estado vacío: ícono grande con halo, título y texto que invita a dar el primer paso.
class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.title, required this.message, this.color, this.action});
  final IconData icon;
  final String title;
  final Widget message;
  final Color? color;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final base = color ?? tokens.accent;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(children: [
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(colors: [base.withValues(alpha: 0.28), base.withValues(alpha: 0.04)]),
            border: Border.all(color: base.withValues(alpha: 0.3)),
          ),
          child: Icon(icon, color: base, size: 30),
        ),
        const SizedBox(height: 12),
        Text(title, textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
        const SizedBox(height: 4),
        DefaultTextStyle.merge(textAlign: TextAlign.center, style: TextStyle(color: tokens.muted, fontSize: 13, height: 1.4), child: message),
        if (action != null) ...[const SizedBox(height: 12), action!],
      ]),
    );
  }
}

/// Barra de progreso dividida en tramos (por ejemplo, hacia el próximo hito de la racha).
class SegmentedProgress extends StatelessWidget {
  const SegmentedProgress({super.key, required this.value, this.segments = 3, this.color, this.height = 8});
  final double value;
  final int segments;
  final Color? color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    final base = color ?? tokens.accent;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final track = dark ? Colors.white.withValues(alpha: 0.08) : Colors.black.withValues(alpha: 0.07);
    return Row(children: [
      for (var i = 0; i < segments; i++) ...[
        if (i > 0) const SizedBox(width: 6),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(height),
            child: Stack(children: [
              Container(height: height, color: track),
              FractionallySizedBox(
                widthFactor: ((value * segments) - i).clamp(0.0, 1.0),
                child: Container(height: height, decoration: BoxDecoration(gradient: LinearGradient(colors: [base.withValues(alpha: 0.75), base]))),
              ),
            ]),
          ),
        ),
      ],
    ]);
  }
}

/// Barra horizontal de un macronutriente o de un avance, con su color.
class MeterBar extends StatelessWidget {
  const MeterBar({super.key, required this.value, required this.color, this.height = 8});
  final double value;
  final Color color;
  final double height;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: Stack(children: [
        Container(height: height, color: dark ? Colors.white.withValues(alpha: 0.07) : Colors.black.withValues(alpha: 0.06)),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: value.clamp(0.0, 1.0)),
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeOutCubic,
          builder: (context, animated, _) => FractionallySizedBox(widthFactor: animated, child: Container(height: height, color: color)),
        ),
      ]),
    );
  }
}

/// Cifra grande con unidad, para kcal, IMC y días.
class BigNumber extends StatelessWidget {
  const BigNumber(this.value, {super.key, this.unit, this.size = 40, this.color, this.valueKey});
  final String value;
  final String? unit;
  final double size;
  final Color? color;
  final Key? valueKey;

  @override
  Widget build(BuildContext context) {
    final tokens = FitTokens.of(context);
    return Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, mainAxisSize: MainAxisSize.min, children: [
      Text(value, key: valueKey, style: TextStyle(fontSize: size, height: 1, fontWeight: FontWeight.w800, letterSpacing: -1, color: color, fontFeatures: tabularFigures)),
      if (unit != null) ...[
        const SizedBox(width: 6),
        Text(unit!, style: TextStyle(fontSize: math.max(13, size * 0.36), fontWeight: FontWeight.w600, color: tokens.muted)),
      ],
    ]);
  }
}

/// Interpola dos números según el ancho disponible (útil para tamaños de letra entre teléfono y escritorio).
double responsiveValue(BuildContext context, double phone, double desktop) {
  final width = MediaQuery.sizeOf(context).width;
  final t = ((width - 360) / (1280 - 360)).clamp(0.0, 1.0);
  return lerpDouble(phone, desktop, t)!;
}
