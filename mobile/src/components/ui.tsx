import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius } from "@/lib/theme";

// ---------- Text ----------

type Weight = keyof typeof fonts;
export function T({
  children,
  w = "regular",
  size = 15,
  color = colors.ink,
  style,
  center,
  lines,
  selectable,
}: {
  children: ReactNode;
  w?: Weight;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  center?: boolean;
  lines?: number;
  selectable?: boolean;
}) {
  return (
    <Text
      numberOfLines={lines}
      selectable={selectable}
      style={[{ fontFamily: fonts[w], fontSize: size, color, lineHeight: Math.round(size * 1.6), writingDirection: "rtl" }, center && { textAlign: "center" }, style]}
    >
      {children}
    </Text>
  );
}

// ---------- Layout ----------

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  padded = true,
  edges = [],
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  edges?: ("top" | "bottom")[];
}) {
  const content = <View style={[padded && { padding: 16, gap: 14 }, { paddingBottom: 40 }]}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.sand }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand600} colors={[colors.brand600]} /> : undefined}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padded && { padding: 16 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Row({ children, gap = 8, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, wrap && { flexWrap: "wrap" }, style]}>{children}</View>;
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const s = [styles.card, style];
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...s, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  return <View style={s}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={{ justifyContent: "space-between", marginTop: 6 }}>
      <T w="bold" size={18}>
        {title}
      </T>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <T w="semibold" color={colors.brand700} size={14}>
            {action} ←
          </T>
        </Pressable>
      )}
    </Row>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 4 }} />;
}

// ---------- Buttons ----------

type Variant = "primary" | "earth" | "outline" | "ghost" | "danger";
const variantStyle: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.brand600, fg: colors.white },
  earth: { bg: colors.earth500, fg: colors.white },
  outline: { bg: colors.white, fg: colors.ink, border: colors.earth200 },
  ghost: { bg: "transparent", fg: colors.ink },
  danger: { bg: colors.red, fg: colors.white },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const v = variantStyle[variant];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={off ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        small && { paddingVertical: 7, paddingHorizontal: 12 },
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, borderWidth: v.border ? 1 : 0 },
        pressed && !off && { opacity: 0.85 },
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon}
      <T w="semibold" color={v.fg} size={small ? 13 : 15}>
        {title}
      </T>
    </Pressable>
  );
}

// ---------- Inputs ----------

export function Field({ label, hint, children, style }: { label: string; hint?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <T w="medium" size={14} color={colors.muted}>
        {label}
      </T>
      {children}
      {hint ? (
        <T size={12} color={colors.faint}>
          {hint}
        </T>
      ) : null}
    </View>
  );
}

export function Input({ label, hint, ltr, style, fieldStyle, ...props }: TextInputProps & { label?: string; hint?: string; ltr?: boolean; fieldStyle?: StyleProp<ViewStyle> }) {
  const [focus, setFocus] = useState(false);
  const input = (
    <TextInput
      placeholderTextColor={colors.faint}
      {...props}
      onFocus={(e) => {
        setFocus(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocus(false);
        props.onBlur?.(e);
      }}
      style={[
        styles.input,
        props.multiline && { minHeight: 110, textAlignVertical: "top" },
        focus && { borderColor: colors.brand500 },
        ltr && { writingDirection: "ltr" },
        style,
      ]}
    />
  );
  return label ? (
    <Field label={label} hint={hint} style={fieldStyle}>
      {input}
    </Field>
  ) : (
    input
  );
}

export function Switch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => onChange(!value)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}>
      <View style={[styles.check, value && { backgroundColor: colors.brand600, borderColor: colors.brand600 }]}>
        {value && (
          <T color={colors.white} size={13} w="bold">
            ✓
          </T>
        )}
      </View>
      <T size={14}>{label}</T>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && { backgroundColor: colors.brand600, borderColor: colors.brand600 }]}>
      <T size={13} w={selected ? "semibold" : "regular"} color={selected ? colors.white : colors.ink}>
        {label}
      </T>
    </Pressable>
  );
}

/** Horizontal or wrapping list of chips for picking one value. */
export function ChipPicker<V extends string | number>({
  options,
  value,
  onChange,
  wrap = true,
}: {
  options: { value: V; label: string }[];
  value: V | null | undefined;
  onChange: (v: V) => void;
  wrap?: boolean;
}) {
  const chips = options.map((o) => <Chip key={String(o.value)} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />);
  if (wrap) return <Row wrap>{chips}</Row>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {chips}
    </ScrollView>
  );
}

/** Dropdown-like field that opens a searchable list. */
export function Select({
  label,
  placeholder = "اختر",
  value,
  options,
  onChange,
  allowEmpty,
}: {
  label?: string;
  placeholder?: string;
  value: string | null | undefined;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  allowEmpty?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label;
  const list = allowEmpty ? [{ value: "", label: allowEmpty }, ...options] : options;
  const body = (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.input, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }]}>
        <T color={current ? colors.ink : colors.faint}>{current ?? (value === "" && allowEmpty ? allowEmpty : placeholder)}</T>
        <T color={colors.faint}>▾</T>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <T w="bold" size={17} style={{ marginBottom: 8 }}>
            {label ?? placeholder}
          </T>
          <FlatList
            data={list}
            keyExtractor={(o) => o.value || "_empty"}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, item.value === value && { backgroundColor: colors.brand50 }, pressed && { opacity: 0.7 }]}
              >
                <T w={item.value === value ? "semibold" : "regular"}>{item.label}</T>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
  return label ? <Field label={label}>{body}</Field> : body;
}

// ---------- Status ----------

const tones = {
  green: { bg: colors.brand50, fg: colors.brand700 },
  earth: { bg: colors.earth50, fg: colors.earth700 },
  gray: { bg: "#f1f2f3", fg: "#4b5563" },
  red: { bg: colors.red50, fg: colors.red },
  blue: { bg: colors.blue50, fg: colors.blue700 },
  amber: { bg: colors.amber50, fg: colors.amber700 },
};
export type Tone = keyof typeof tones;

export function Badge({ label, tone = "gray" }: { label: string; tone?: Tone }) {
  return (
    <View style={{ backgroundColor: tones[tone].bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2, alignSelf: "flex-start" }}>
      <T size={12} w="semibold" color={tones[tone].fg}>
        {label}
      </T>
    </View>
  );
}

export function Verified({ status }: { status?: string }) {
  if (status !== "verified") return null;
  return (
    <T size={12} w="semibold" color={colors.brand600}>
      ✓ موثق
    </T>
  );
}

export function Notice({ children, tone = "earth" }: { children: ReactNode; tone?: Tone }) {
  return (
    <View style={{ backgroundColor: tones[tone].bg, borderRadius: radius.md, padding: 12 }}>
      {typeof children === "string" ? (
        <T size={14} color={tones[tone].fg}>
          {children}
        </T>
      ) : (
        children
      )}
    </View>
  );
}

export function Loading({ full = true }: { full?: boolean }) {
  return (
    <View style={[{ alignItems: "center", justifyContent: "center", padding: 32 }, full && { flex: 1, backgroundColor: colors.sand }]}>
      <ActivityIndicator size="large" color={colors.brand600} />
    </View>
  );
}

export function Empty({ icon = "🐑", title, children }: { icon?: string; title: string; children?: ReactNode }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 32, gap: 6 }}>
      <T size={40}>{icon}</T>
      <T w="semibold" center>
        {title}
      </T>
      {children}
    </Card>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={{ padding: 24, gap: 12, alignItems: "center", flex: 1, justifyContent: "center", backgroundColor: colors.sand }}>
      <T size={36}>⚠️</T>
      <T center>{error instanceof Error ? error.message : "حدث خطأ غير متوقع."}</T>
      {onRetry && <Button title="حاول مرة أخرى" variant="outline" onPress={onRetry} />}
    </View>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card style={{ flex: 1, padding: 12 }}>
      <T size={12} color={colors.muted}>
        {label}
      </T>
      <T w="bold" size={18}>
        {value}
      </T>
    </Card>
  );
}

// ---------- Toasts & confirmations ----------

type FeedbackCtx = {
  toast: (message: string, tone?: "green" | "red") => void;
  confirm: (message: string, opts?: { okText?: string; danger?: boolean }) => Promise<boolean>;
};
const Feedback = createContext<FeedbackCtx | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toastState, setToast] = useState<{ message: string; tone: "green" | "red" } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dialog, setDialog] = useState<{ message: string; okText: string; danger: boolean; resolve: (v: boolean) => void } | null>(null);

  const toast = useCallback((message: string, tone: "green" | "red" = "green") => {
    setToast({ message, tone });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);
  const confirm = useCallback(
    (message: string, opts: { okText?: string; danger?: boolean } = {}) =>
      new Promise<boolean>((resolve) => setDialog({ message, okText: opts.okText ?? "تأكيد", danger: !!opts.danger, resolve })),
    [],
  );
  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  return (
    <Feedback.Provider value={{ toast, confirm }}>
      {children}
      {toastState && (
        <View pointerEvents="none" style={[styles.toast, { backgroundColor: toastState.tone === "red" ? colors.red : colors.brand700 }]}>
          <T color={colors.white} w="medium" center>
            {toastState.message}
          </T>
        </View>
      )}
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => close(false)}>
        <View style={[styles.backdrop, { justifyContent: "center", padding: 24 }]}>
          <View style={[styles.card, { gap: 16, padding: 20 }]}>
            <T size={16} w="medium">
              {dialog?.message}
            </T>
            <Row>
              <Button title={dialog?.okText ?? "تأكيد"} variant={dialog?.danger ? "danger" : "primary"} onPress={() => close(true)} style={{ flex: 1 }} />
              <Button title="إلغاء" variant="outline" onPress={() => close(false)} style={{ flex: 1 }} />
            </Row>
          </View>
        </View>
      </Modal>
    </Feedback.Provider>
  );
}

export function useFeedback() {
  const c = useContext(Feedback);
  if (!c) throw new Error("useFeedback outside FeedbackProvider");
  return c;
}

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    shadowColor: "#1d2b36",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.earth200,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    minWidth: 0, // lets inputs shrink inside rows
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.earth300,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "70%",
  },
  option: { paddingVertical: 12, paddingHorizontal: 10, borderRadius: 10 },
  toast: {
    position: "absolute",
    bottom: 90,
    left: 20,
    right: 20,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
