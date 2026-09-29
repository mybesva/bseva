#!/usr/bin/env python3
"""Interactive Android UI QA via adb uiautomator (release certification)."""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

DEVICE = __import__("os").environ.get("ANDROID_DEVICE", "emulator-5554")
API = __import__("os").environ.get("API_BASE", "http://127.0.0.1:8000/api/v1")
PASS = __import__("os").environ.get("QA_PASSWORD", "TestPass123!")
OUT = Path(__import__("tempfile").gettempdir()) / "bseva_android_ui_qa"
OUT.mkdir(parents=True, exist_ok=True)

PASS_N = FAIL_N = 0
results: list[tuple[str, str, str]] = []


def adb(*args: str, check: bool = True) -> str:
    cmd = ["adb", "-s", DEVICE, *args]
    p = subprocess.run(cmd, capture_output=True, text=True)
    if check and p.returncode != 0:
        raise RuntimeError(f"adb failed: {' '.join(cmd)}\n{p.stderr}")
    return p.stdout + p.stderr


def record(name: str, status: str, detail: str) -> None:
    global PASS_N, FAIL_N
    if status == "PASS":
        PASS_N += 1
    elif status == "FAIL":
        FAIL_N += 1
    results.append((name, status, detail))
    print(f"{name:<50} {status:<8} {detail}")


@dataclass
class Node:
    text: str
    desc: str
    cls: str
    bounds: tuple[int, int, int, int]
    clickable: bool

    @property
    def cx(self) -> int:
        return (self.bounds[0] + self.bounds[2]) // 2

    @property
    def cy(self) -> int:
        return (self.bounds[1] + self.bounds[3]) // 2


def parse_bounds(raw: str) -> tuple[int, int, int, int] | None:
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", raw or "")
    if not m:
        return None
    return tuple(int(x) for x in m.groups())  # type: ignore[return-value]


def dump_ui(tag: str) -> list[Node]:
    safe = re.sub(r"[^a-zA-Z0-9._-]+", "_", tag)[:48]
    remote = f"/sdcard/ui_{safe}.xml"
    adb("shell", "uiautomator", "dump", remote, check=False)
    local = OUT / f"{safe}.xml"
    adb("pull", remote, str(local), check=False)
    if not __import__("os").environ.get("SKIP_QA_PNG"):
        png = OUT / f"{safe}.png"
        with open(png, "wb") as fh:
            subprocess.run(["adb", "-s", DEVICE, "exec-out", "screencap", "-p"], stdout=fh, check=False)
    if not local.exists():
        return []
    root = ET.parse(local).getroot()
    nodes: list[Node] = []
    for el in root.iter("node"):
        b = parse_bounds(el.get("bounds", ""))
        if not b:
            continue
        nodes.append(
            Node(
                text=el.get("text") or "",
                desc=el.get("content-desc") or "",
                cls=el.get("class") or "",
                bounds=b,
                clickable=el.get("clickable") == "true",
            )
        )
    return nodes


def ui_blob(nodes: list[Node]) -> str:
    return " ".join(n.text or n.desc for n in nodes if (n.text or n.desc))


def ui_text(nodes: list[Node]) -> str:
    return ui_blob(nodes)[:200]


def ui_has(nodes: list[Node], *needles: str) -> bool:
    blob = ui_blob(nodes).lower()
    return any(n.lower() in blob for n in needles)


def find(nodes: list[Node], *labels: str, cls: str | None = None) -> Node | None:
    for label in labels:
        ll = label.lower()
        for n in nodes:
            if cls and cls not in n.cls:
                continue
            if ll in (n.desc.lower(), n.text.lower()):
                return n
    return None


def tap(n: Node) -> None:
    adb("shell", "input", "tap", str(n.cx), str(n.cy))


def adb_text(value: str) -> None:
    # Pass through subprocess argv so @ and ! reach the device unchanged.
    subprocess.run(["adb", "-s", DEVICE, "shell", "input", "text", value], check=False)


def clear_field() -> None:
    adb("shell", "input", "keyevent", "123", check=False)  # MOVE_END
    for _ in range(40):
        adb("shell", "input", "keyevent", "67", check=False)  # DEL


def scroll_find(*labels: str, attempts: int = 4) -> Node | None:
    for i in range(attempts):
        nodes = dump_ui(f"scroll_{i}")
        hit = find(nodes, *labels, cls="Button") or find(nodes, *labels)
        if hit:
            return hit
        adb("shell", "input", "swipe", "540", "1600", "540", "600", "450", check=False)
        time.sleep(0.8)
    return None


def ensure_login_screen(nodes: list[Node], role: str | None) -> list[Node]:
    if find(nodes, "Email or phone", "ईमेल या फ़ोन", cls="EditText"):
        return nodes
    eng = find(nodes, "English")
    if eng:
        tap(eng)
        time.sleep(0.8)
    portal = {
        "customer": ("Login as Customer", "ग्राहक के रूप में लॉगिन"),
        "pujari": ("Login as Pujari", "पुजारी के रूप में लॉगिन"),
    }.get(role or "", ("Login as Customer",))
    btn = scroll_find(*portal)
    if btn:
        tap(btn)
        time.sleep(3)
        return dump_ui("login_form")
    return dump_ui("login_missing")


def login_mobile(pkg: str, email: str, role: str | None = None) -> list[Node]:
    adb("reverse", "tcp:8000", "tcp:8000", check=False)
    adb("shell", "pm", "clear", pkg, check=False)
    time.sleep(1)
    for perm in (
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
    ):
        adb("shell", "pm", "grant", pkg, perm, check=False)
    adb("shell", "am", "start", "-n", f"{pkg}/.MainActivity", check=False)
    time.sleep(8)
    nodes = dump_ui("login")
    if ui_has(nodes, "Unable to load script"):
        return nodes
    if pkg == "com.bseva.app":
        nodes = ensure_login_screen(nodes, role)
    email_field = find(nodes, "Email or phone", "ईमेल या फ़ोन", cls="EditText")
    pwd_field = find(nodes, "Password", "पासवर्ड", cls="EditText")
    if not email_field or not pwd_field:
        return dump_ui("login_missing")
    tap(email_field)
    time.sleep(0.3)
    clear_field()
    adb_text(email)
    time.sleep(0.4)
    tap(pwd_field)
    time.sleep(0.3)
    clear_field()
    adb_text(PASS)
    time.sleep(0.4)
    adb("shell", "input", "keyevent", "4", check=False)  # dismiss keyboard
    time.sleep(0.6)
    nodes = dump_ui("login_ready")
    sign = find(
        nodes,
        "Sign In",
        "Sign in",
        "Admin sign in",
        "साइन इन",
        cls="Button",
    )
    if sign:
        tap(sign)
    else:
        adb("shell", "input", "keyevent", "66", check=False)
    time.sleep(5)
    dismiss_system_dialogs()
    time.sleep(2)
    return dump_ui("home")


def dismiss_system_dialogs() -> None:
    for _ in range(3):
        nodes = dump_ui("dialog")
        btn = (
            find(nodes, "Allow only while using the app", cls="Button")
            or find(nodes, "While using the app", cls="Button")
            or find(nodes, "Allow", cls="Button")
            or find(nodes, "Don't allow", cls="Button")
            or find(nodes, "Deny", cls="Button")
            or find(nodes, "OK", cls="Button")
        )
        if not btn:
            if ui_has(nodes, "Location access for this app", "Allow only while using the app"):
                adb("shell", "input", "tap", "540", "1380", check=False)
                time.sleep(1.5)
                continue
            break
        tap(btn)
        time.sleep(1)


def logged_in(nodes: list[Node]) -> bool:
    tabs = sum(1 for label in ("Home", "Services", "Bookings", "Wallet", "More", "Dashboard") if find(nodes, label))
    return tabs >= 2


def api_req(method: str, path: str, data=None, token: str | None = None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(f"{API}{path}", data=body, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def open_deep_link(uri: str) -> list[Node]:
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", uri, "-n", "com.bseva.app/.MainActivity", check=False)
    time.sleep(3)
    return dump_ui(uri.replace("://", "_").replace("/", "_")[:40])


def tap_tab(nodes: list[Node], label: str, fallback: tuple[int, int]) -> None:
    n = find(nodes, label)
    if n:
        tap(n)
    else:
        adb("shell", "input", "tap", str(fallback[0]), str(fallback[1]), check=False)


def tap_first_event(nodes: list[Node], *preferred: str) -> list[Node] | None:
    search = preferred or ("Rudrabhishek", "Chadhava", "Pravachan", "Gita", "Proxy", "Group", "Temple", "Live")
    for pref in search:
        for n in nodes:
            label = (n.text or n.desc).lower()
            if n.clickable and pref.lower() in label:
                tap(n)
                time.sleep(3)
                return dump_ui("event_detail")
    for n in nodes:
        label = (n.text or n.desc).lower()
        if n.clickable and any(k.lower() in label for k in search):
            tap(n)
            time.sleep(3)
            return dump_ui("event_detail")
    return None


def main() -> int:
    print(f"Android UI QA | device={DEVICE} | out={OUT}")
    adb("reverse", "tcp:8000", "tcp:8000", check=False)

    # Customer login
    home = login_mobile("com.bseva.app", "customer1@bseva.test", "customer")
    if ui_has(home, "Unable to load script"):
        record("customer_login_ui", "FAIL", "JS bundle missing")
    elif logged_in(home):
        record("customer_login_ui", "PASS", "tab bar visible")
    elif ui_has(home, "Login failed", "login failed", "Customer sign in", "Admin sign in"):
        record("customer_login_ui", "FAIL", ui_text(home))
    else:
        record("customer_login_ui", "FAIL", ui_text(home))

    if logged_in(home):
        tap_tab(home, "Services", (270, 2100))
        time.sleep(3)
        svc = dump_ui("customer_services")
        if ui_has(svc, "Puja", "Chadhava", "Pravachan", "Explore"):
            record("customer_services_seva", "PASS", ui_text(svc))
        else:
            record("customer_services_seva", "FAIL", ui_text(svc))

        chip_labels = {"puja": "Puja", "chadhava": "Chadhava", "pravachan": "Pravachan"}
        for stype, needles in [
            ("puja", ("Puja", "Rudrabhishek", "Proxy", "Group", "Temple", "Explore")),
            ("chadhava", ("Chadhava", "Explore")),
            ("pravachan", ("Pravachan", "Gita", "Katha", "Explore")),
        ]:
            nodes = open_deep_link(f"bseva://customer/seva?type={stype}")
            if not ui_has(nodes, "Explore", "Scheduled"):
                tap_tab(dump_ui("nav_services"), "Services", (270, 2100))
                time.sleep(2)
                svc2 = dump_ui("services_retry")
                chip = find(svc2, chip_labels[stype]) or find(svc2, f"{chip_labels[stype]} Seva")
                if chip:
                    tap(chip)
                    time.sleep(3)
                    nodes = dump_ui(f"seva_{stype}")
            if ui_has(nodes, *needles):
                record(f"customer_seva_{stype}", "PASS", ui_text(nodes))
                prefer = {
                    "puja": ("Rudrabhishek", "Group Live", "Proxy", "Temple"),
                    "chadhava": ("Chadhava", "Flower"),
                    "pravachan": ("Pravachan", "Gita", "Katha"),
                }[stype]
                detail = tap_first_event(nodes, *prefer)
                if detail and ui_has(
                    detail,
                    "Register",
                    "Sankalp",
                    "Family",
                    "Participation",
                    "Offline",
                    "Online",
                    "Hybrid",
                    "Scheduled",
                    "Upcoming",
                ):
                    record(f"customer_event_{stype}", "PASS", ui_text(detail))
                else:
                    record(f"customer_event_{stype}", "FAIL", ui_text(detail or []))
            else:
                record(f"customer_seva_{stype}", "FAIL", ui_text(nodes))

        fam = open_deep_link("bseva://customer/family-sankalp")
        record(
            "customer_family_sankalp",
            "PASS" if ui_has(fam, "Family", "Sankalp", "Add", "Member") else "FAIL",
            ui_text(fam),
        )

        my = open_deep_link("bseva://customer/my-seva")
        if ui_has(my, "My Seva", "SEVA", "No registrations", "SEVA-"):
            record("customer_my_seva", "PASS", ui_text(my))
            if ui_has(my, "Proof", "Shipped", "Join", "Prasad", "Delivered"):
                record("customer_proof_prasad_join", "PASS", ui_text(my))
            else:
                record("customer_proof_prasad_join", "FAIL", "badges not visible")
        else:
            record("customer_my_seva", "FAIL", ui_text(my))

        book = open_deep_link("bseva://customer/book/ganapathi-puja")
        record(
            "customer_normal_puja_regression",
            "PASS" if ui_has(book, "Book", "Ganapathi", "Standard", "Package") else "FAIL",
            ui_text(book),
        )

    # Pujari
    phome = login_mobile("com.bseva.app", "pujari1@bseva.test", "pujari")
    dismiss_system_dialogs()
    time.sleep(1)
    phome = dump_ui("pujari_home")
    if logged_in(phome):
        record("pujari_login_ui", "PASS", "tab bar visible")
        plist = open_deep_link("bseva://pujari/seva-events")
        dismiss_system_dialogs()
        plist = dump_ui("pujari_seva_list")
        if ui_has(plist, "Seva Events", "Rudrabhishek", "Pravachan", "Group") and not ui_has(
            plist, "Location access for this app"
        ):
            record("pujari_seva_list", "PASS", ui_text(plist))
            detail = tap_first_event(plist)
            if detail and ui_has(detail, "Manifest", "Attendee", "Participant", "Join", "Complete", "Venue"):
                record("pujari_event_detail", "PASS", ui_text(detail))
            else:
                record("pujari_event_detail", "FAIL", ui_text(detail or []))
            if detail and ui_has(detail, "OTP", "GPS", "Samagri"):
                record("pujari_pravachan_no_puja_controls", "FAIL", "puja controls visible")
            else:
                record("pujari_pravachan_no_puja_controls", "PASS", "no irrelevant controls")
        else:
            record("pujari_seva_list", "FAIL", ui_text(plist))
    else:
        record("pujari_login_ui", "FAIL", ui_text(phome))

    # Admin
    ahome = login_mobile("com.bseva.admin", "super@bseva.test")
    if logged_in(ahome) or ui_has(ahome, "Dashboard", "Customers"):
        record("admin_login_ui", "PASS", "admin home visible")
        dismiss_system_dialogs()
        adb(
            "shell",
            "am",
            "start",
            "-a",
            "android.intent.action.VIEW",
            "-d",
            "bsevaadmin://seva-events",
            "-n",
            "com.bseva.admin/.MainActivity",
            check=False,
        )
        time.sleep(3)
        dismiss_system_dialogs()
        alist = dump_ui("admin_seva")
        if ui_has(alist, "Seva Events", "Rudrabhishek", "Registrations", "Pravachan") and not ui_has(
            alist, "Location permission", "Allow B-Seva to send you notifications"
        ):
            record("admin_seva_events", "PASS", ui_text(alist))
            detail = tap_first_event(alist, "Rudrabhishek", "Pravachan", "Group")
            if detail and ui_has(detail, "Registration", "Pujari", "Status", "Manifest", "Attendee"):
                record("admin_seva_detail", "PASS", ui_text(detail))
            else:
                record("admin_seva_detail", "FAIL", ui_text(detail or []))
        else:
            record("admin_seva_events", "FAIL", ui_text(alist))
    elif ui_has(ahome, "Unable to load script"):
        record("admin_login_ui", "FAIL", "JS bundle missing")
    else:
        record("admin_login_ui", "FAIL", ui_text(ahome))

    # Feature flags visual
    try:
        tok = api_req("POST", "/auth/login", {"identifier": "super@bseva.test", "password": PASS})["access_token"]
        for k in ("seva_events_enabled", "chadhava_enabled", "pravachan_enabled"):
            api_req("PUT", "/admin/config", {"key": k, "value": True}, tok)
        fhome = login_mobile("com.bseva.app", "customer1@bseva.test", "customer")
        tap_tab(fhome, "Services", (270, 2100))
        time.sleep(3)
        on = dump_ui("flags_on")
        api_req("PUT", "/admin/config", {"key": "chadhava_enabled", "value": False}, tok)
        adb("shell", "am", "force-stop", "com.bseva.app", check=False)
        time.sleep(1)
        adb("shell", "am", "start", "-n", "com.bseva.app/.MainActivity", check=False)
        time.sleep(4)
        # re-auth if needed
        if ui_has(dump_ui("flags_check"), "Sign In", "साइन"):
            fhome = login_mobile("com.bseva.app", "customer1@bseva.test", "customer")
        tap_tab(dump_ui("flags_nav"), "Services", (270, 2100))
        time.sleep(3)
        off = dump_ui("flags_off")
        if ui_has(off, "Chadhava"):
            record("mobile_flag_chadhava_ui", "FAIL", "chip still visible")
        else:
            record("mobile_flag_chadhava_ui", "PASS", "Chadhava hidden")
        for k in ("seva_events_enabled", "chadhava_enabled", "pravachan_enabled"):
            api_req("PUT", "/admin/config", {"key": k, "value": True}, tok)
    except Exception as e:
        record("mobile_flag_chadhava_ui", "FAIL", str(e))

    print("---")
    print(f"PASS={PASS_N} FAIL={FAIL_N}")
    print(f"Artifacts: {OUT}")
    (OUT / "results.json").write_text(json.dumps(results, indent=2))
    return 0 if FAIL_N == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
