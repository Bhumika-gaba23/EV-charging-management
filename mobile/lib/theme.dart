import 'package:flutter/material.dart';

const silver = Color(0xFFE0E2E6);
const muted = Color(0xFF93969F);
const panel = Color(0xFF17181C);
const edge = Color(0xFF303137);

final chargeFlowTheme = ThemeData(
  useMaterial3: true,
  brightness: Brightness.dark,
  scaffoldBackgroundColor: const Color(0xFF0B0C0F),
  colorScheme: const ColorScheme.dark(
    primary: silver,
    onPrimary: Color(0xFF101114),
    secondary: Color(0xFFB6BAC4),
    surface: panel,
    onSurface: silver,
    outline: edge,
    error: Color(0xFFFFB4AB),
  ),
  appBarTheme: const AppBarTheme(
    backgroundColor: Color(0xFF0B0C0F),
    foregroundColor: silver,
    centerTitle: false,
    elevation: 0,
    scrolledUnderElevation: 0,
  ),
  navigationBarTheme: NavigationBarThemeData(
    backgroundColor: const Color(0xFF101115),
    indicatorColor: const Color(0xFF33353C),
    labelTextStyle: WidgetStateProperty.all(
      const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
    ),
  ),
  inputDecorationTheme: InputDecorationTheme(
    filled: true,
    fillColor: panel,
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: edge)),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: edge)),
  ),
  filledButtonTheme: FilledButtonThemeData(
    style: FilledButton.styleFrom(
      minimumSize: const Size(48, 52),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
    ),
  ),
  outlinedButtonTheme: OutlinedButtonThemeData(
    style: OutlinedButton.styleFrom(
      minimumSize: const Size(48, 48),
      side: const BorderSide(color: edge),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
  ),
  dividerTheme: const DividerThemeData(color: edge),
);
