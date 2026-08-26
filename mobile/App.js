import { useMemo, useState } from "react";
import { Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const API = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000")
).replace(/\/$/, "");

async function api(path, token, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API}/api/v1${path}`, { ...opts, headers });
  } catch {
    throw new Error("Unable to reach BSeva. Please try again later.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Something went wrong. Please try again.");
  }
  return data;
}

function rupees(paise) {
  return `₹${(Number(paise || 0) / 100).toLocaleString("en-IN")}`;
}

function roleLabel(role) {
  if (role === "pujari") return "Pujari";
  if (role === "admin") return "Admin";
  return "Customer";
}

export default function App() {
  const [authScreen, setAuthScreen] = useState("login");
  const [tab, setTab] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [accountType, setAccountType] = useState("customer");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [wallet, setWallet] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadAmt, setLoadAmt] = useState("500");
  const [busy, setBusy] = useState(false);

  const palette = useMemo(() => ({ saffron: "#C45C26", cream: "#FBF6EE", ink: "#2C1810" }), []);

  function logout() {
    setUser(null);
    setToken("");
    setWallet(null);
    setBookings([]);
    setUsers([]);
    setMenuOpen(false);
    setTab("home");
    setAuthScreen("login");
    setError("");
  }

  function go(next) {
    setTab(next);
    setMenuOpen(false);
    setError("");
  }

  async function afterAuth(data) {
    setToken(data.access_token);
    setUser(data.user);
    setTab("home");
    setMenuOpen(false);
    try {
      setWallet(await api("/wallet", data.access_token));
    } catch {
      setWallet(null);
    }
    try {
      setBookings(await api("/bookings", data.access_token));
    } catch {
      setBookings([]);
    }
    if (data.user.role === "admin") {
      try {
        setUsers(await api("/admin/users", data.access_token));
      } catch {
        setUsers([]);
      }
    }
  }

  async function login() {
    setError("");
    setBusy(true);
    try {
      await afterAuth(
        await api("/auth/login", null, {
          method: "POST",
          body: JSON.stringify({ identifier, password }),
        })
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    setError("");
    setBusy(true);
    try {
      await api("/auth/otp/request", null, {
        method: "POST",
        body: JSON.stringify({ phone, email, purpose: "register" }),
      });
      await afterAuth(
        await api("/auth/register", null, {
          method: "POST",
          body: JSON.stringify({
            account_type: accountType,
            name,
            email,
            phone,
            password,
            otp,
            location: "Bengaluru",
            latitude: 12.9716,
            longitude: 77.5946,
            language: "en",
            calendar_preference: "north",
            requested_level: accountType === "pujari" ? 2 : undefined,
          }),
        })
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const upcoming = bookings.filter((b) => b.status === "confirmed" || b.status === "pending");
  const menuItems = [
    { id: "home", label: "Home" },
    { id: "bookings", label: user?.role === "pujari" ? "Assigned pujas" : "My bookings" },
    ...(user?.role === "customer" ? [{ id: "wallet", label: "Wallet" }] : []),
    ...(user?.role === "admin" ? [{ id: "users", label: "Users" }] : []),
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.cream }]}>
      {user ? (
        <View style={styles.header}>
          <Text style={[styles.brandSmall, { color: palette.saffron }]}>BSeva</Text>
          <Pressable onPress={() => setMenuOpen((o) => !o)} style={styles.menuBtn} hitSlop={12}>
            <View style={styles.bar} />
            <View style={styles.bar} />
            <View style={styles.bar} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        {!user ? (
          <>
            <Text style={[styles.brand, { color: palette.saffron }]}>BSeva</Text>
            <Text style={styles.sub}>Book trusted pujaris for every occasion</Text>
          </>
        ) : null}

        {!user && authScreen === "login" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.label}>Email or phone</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              placeholder="you@email.com"
              placeholderTextColor="#b09a88"
              value={identifier}
              onChangeText={setIdentifier}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              placeholder="Your password"
              placeholderTextColor="#b09a88"
              value={password}
              onChangeText={setPassword}
            />
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Pressable style={[styles.btn, { backgroundColor: palette.saffron }]} onPress={login} disabled={busy}>
              <Text style={styles.btnText}>{busy ? "Please wait…" : "Login"}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setError("");
                setAuthScreen("register");
              }}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>New to BSeva? Create an account</Text>
            </Pressable>
          </View>
        ) : null}

        {!user && authScreen === "register" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create your account</Text>
            <Text style={styles.hint}>I want to join as</Text>
            <View style={styles.rowBtns}>
              <Pressable
                style={[styles.choice, accountType === "customer" && styles.choiceOn]}
                onPress={() => setAccountType("customer")}
              >
                <Text style={styles.choiceText}>Customer</Text>
              </Pressable>
              <Pressable
                style={[styles.choice, accountType === "pujari" && styles.choiceOn]}
                onPress={() => setAccountType("pujari")}
              >
                <Text style={styles.choiceText}>Pujari</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#b09a88" />
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@email.com" placeholderTextColor="#b09a88" />
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" value={phone} onChangeText={setPhone} placeholder="10-digit mobile" placeholderTextColor="#b09a88" />
            <Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#b09a88" />
            <Text style={styles.label}>OTP</Text>
            <TextInput style={styles.input} keyboardType="number-pad" value={otp} onChangeText={setOtp} placeholder="6-digit code" placeholderTextColor="#b09a88" />
            <Text style={styles.hint}>We’ll send a code to your phone when you continue.</Text>
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Pressable style={[styles.btn, { backgroundColor: palette.saffron }]} onPress={register} disabled={busy}>
              <Text style={styles.btnText}>{busy ? "Creating account…" : "Create account"}</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setError("");
                setAuthScreen("login");
              }}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>Already have an account? Login</Text>
            </Pressable>
          </View>
        ) : null}

        {user && tab === "home" ? (
          <View style={styles.card}>
            <Text style={styles.hello}>Namaste, {user.name.split(" ")[0]}</Text>
            <Text style={styles.hint}>{roleLabel(user.role)}</Text>
            {user.role === "customer" ? (
              <>
                <Text style={styles.body}>Book a puja with a verified pujari near you.</Text>
                <Pressable style={[styles.btn, { backgroundColor: palette.saffron }]} onPress={() => go("bookings")}>
                  <Text style={styles.btnText}>View my bookings</Text>
                </Pressable>
                <Pressable style={styles.btnOutline} onPress={() => go("wallet")}>
                  <Text style={styles.btnOutlineText}>
                    Wallet{wallet ? ` · ${rupees(wallet.wallet?.balance_paise)}` : ""}
                  </Text>
                </Pressable>
              </>
            ) : null}
            {user.role === "pujari" ? (
              <>
                <Text style={styles.body}>See pujas assigned to you from Assigned pujas in the menu.</Text>
                <Pressable style={[styles.btn, { backgroundColor: palette.saffron }]} onPress={() => go("bookings")}>
                  <Text style={styles.btnText}>Assigned pujas</Text>
                </Pressable>
              </>
            ) : null}
            {user.role === "admin" ? (
              <>
                <Text style={styles.body}>Manage customers, pujaris, and bookings.</Text>
                <Pressable style={[styles.btn, { backgroundColor: palette.saffron }]} onPress={() => go("users")}>
                  <Text style={styles.btnText}>Manage users</Text>
                </Pressable>
                <Pressable style={styles.btnOutline} onPress={() => go("bookings")}>
                  <Text style={styles.btnOutlineText}>All bookings</Text>
                </Pressable>
              </>
            ) : null}
            {upcoming[0] ? (
              <View style={styles.nextBox}>
                <Text style={styles.h}>Upcoming</Text>
                <Text style={styles.row}>
                  {upcoming[0].service_name} · {upcoming[0].status} · {rupees(upcoming[0].total_paise)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.hint, { marginTop: 16 }]}>No upcoming bookings.</Text>
            )}
          </View>
        ) : null}

        {user && tab === "bookings" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{user.role === "pujari" ? "Assigned pujas" : "My bookings"}</Text>
            {bookings.length === 0 ? <Text style={styles.hint}>No bookings yet.</Text> : null}
            {bookings.map((b) => (
              <View key={b.id} style={styles.bookingCard}>
                <Text style={styles.bookingTitle}>{b.service_name || "Puja"}</Text>
                <Text style={styles.row}>
                  {b.booking_number} · {b.status} · {rupees(b.total_paise)}
                </Text>
                <Text style={styles.hint}>
                  {b.booking_date} {b.start_time || ""}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {user && tab === "wallet" && user.role === "customer" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Wallet</Text>
            <Text style={styles.bal}>{wallet ? rupees(wallet.wallet?.balance_paise) : "—"}</Text>
            <Text style={styles.label}>Add money (₹)</Text>
            <TextInput style={styles.input} value={loadAmt} onChangeText={setLoadAmt} keyboardType="numeric" />
            {error ? <Text style={styles.err}>{error}</Text> : null}
            <Pressable
              style={[styles.btn, { backgroundColor: palette.saffron }]}
              onPress={async () => {
                setError("");
                try {
                  await api("/wallet/load", token, {
                    method: "POST",
                    body: JSON.stringify({ amount_paise: Math.round(Number(loadAmt) * 100) }),
                  });
                  setWallet(await api("/wallet", token));
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              <Text style={styles.btnText}>Add to wallet</Text>
            </Pressable>
          </View>
        ) : null}

        {user && tab === "users" && user.role === "admin" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Users</Text>
            {users.map((u) => (
              <View key={u.id} style={styles.userRow}>
                <Text style={{ flex: 1 }}>
                  {u.name} · {u.role} {u.blocked ? "· blocked" : ""}
                </Text>
                <Pressable
                  onPress={async () => {
                    await api(`/admin/users/${u.id}/block`, token, {
                      method: "POST",
                      body: JSON.stringify({ blocked: !u.blocked, reason: "Blocked by admin" }),
                    });
                    setUsers(await api("/admin/users", token));
                  }}
                >
                  <Text style={{ color: palette.saffron }}>{u.blocked ? "Unblock" : "Block"}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {user && menuOpen ? (
        <View style={styles.drawerWrap} pointerEvents="box-none">
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
          <View style={styles.drawer}>
            <Text style={styles.drawerName}>{user.name}</Text>
            <Text style={styles.hint}>{roleLabel(user.role)}</Text>
            {menuItems.map((item) => (
              <Pressable key={item.id} style={styles.drawerItem} onPress={() => go(item.id)}>
                <Text style={[styles.drawerItemText, tab === item.id && { color: palette.saffron }]}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.drawerItem} onPress={logout}>
              <Text style={[styles.drawerItemText, { color: "#b42318" }]}>Logout</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brandSmall: { fontSize: 24, fontWeight: "800" },
  menuBtn: { width: 36, height: 28, justifyContent: "space-between", paddingVertical: 4 },
  bar: { height: 3, backgroundColor: "#2C1810", borderRadius: 2 },
  drawerWrap: { ...StyleSheet.absoluteFillObject, zIndex: 20, flexDirection: "row", justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(44,24,16,0.35)" },
  drawer: {
    width: 260,
    backgroundColor: "#fff",
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 32,
    elevation: 8,
  },
  drawerName: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
  drawerItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0e6dc" },
  drawerItemText: { fontSize: 16, fontWeight: "600", color: "#2C1810" },
  wrap: { padding: 24, paddingTop: 8 },
  brand: { fontSize: 36, fontWeight: "800" },
  sub: { marginBottom: 24, color: "#5c4033", fontSize: 16 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20, gap: 8 },
  cardTitle: { fontSize: 20, fontWeight: "700", color: "#2C1810" },
  label: { fontWeight: "600", marginTop: 8, color: "#2C1810" },
  hint: { fontSize: 13, color: "#7a6456" },
  body: { fontSize: 15, color: "#5c4033", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#e8d9c8", borderRadius: 10, padding: 12 },
  btn: { marginTop: 16, borderRadius: 10, padding: 14, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700" },
  btnOutline: {
    marginTop: 10,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#C45C26",
  },
  btnOutlineText: { color: "#C45C26", fontWeight: "700" },
  linkWrap: { marginTop: 16, alignItems: "center" },
  link: { color: "#C45C26", fontWeight: "600" },
  hello: { fontSize: 22, fontWeight: "700" },
  err: { color: "#b42318" },
  bal: { fontSize: 28, fontWeight: "700", marginVertical: 8 },
  h: { fontWeight: "700", marginTop: 8 },
  row: { fontSize: 13, color: "#5c4033" },
  nextBox: { marginTop: 16, padding: 12, backgroundColor: "#fff8f2", borderRadius: 10 },
  bookingCard: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0e6dc" },
  bookingTitle: { fontWeight: "700", color: "#2C1810" },
  userRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  rowBtns: { flexDirection: "row", gap: 8 },
  choice: { flex: 1, borderWidth: 1, borderColor: "#e8d9c8", borderRadius: 10, padding: 12, alignItems: "center" },
  choiceOn: { borderColor: "#C45C26", backgroundColor: "#fff4ec" },
  choiceText: { fontWeight: "600" },
});
