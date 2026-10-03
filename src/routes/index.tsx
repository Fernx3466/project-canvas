import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast, Toaster } from "sonner";
import { ArrowDown, ArrowLeft, ArrowRight, Bookmark, CalendarDays, Check, ChevronDown, ChevronRight, Circle, Clock3, Command, FileText, Filter, Folder, FolderClosed, FolderPlus, Grid2X2, Hash, ImagePlus, LayoutGrid, Link2, List, Menu, Moon, MoreHorizontal, PanelLeftClose, Pin, Plus, Search, Settings2, Sparkles, Sun, Tag, Trash2, X } from "lucide-react";
import banner from "@/assets/atelier-banner.jpg";
import type { User } from "@supabase/supabase-js";

type FolderItem = { id: string; owner_id?: string; parent_id: string | null; name: string; description: string; topic: string; icon: string; banner_url: string | null; profile_url: string | null; created_at?: string; updated_at?: string };
type TagItem = { id: string; owner_id?: string; name: string; description: string; color: string; created_at?: string };
type NoteItem = { id: string; owner_id?: string; folder_id: string | null; title: string; content: string; status: string; due_date: string | null; is_pinned: boolean; tag_ids: string[]; created_at: string; updated_at: string };
type View = "home" | "all" | "recent" | "pinned" | "tags" | "folder" | "note";
const now = new Date().toISOString();
const sampleFolders: FolderItem[] = [
  { id: "f1", parent_id: null, name: "Studio refresh", description: "A space for everything behind the new studio identity — from first sparks to the final launch.", topic: "Brand & identity", icon: "✳", banner_url: "sample", profile_url: null },
  { id: "f2", parent_id: "f1", name: "Visual direction", description: "Moodboards, references, and art direction.", topic: "Creative", icon: "◈", banner_url: null, profile_url: null },
  { id: "f3", parent_id: "f1", name: "Launch plan", description: "The steps that take this from idea to reality.", topic: "Planning", icon: "↗", banner_url: null, profile_url: null },
  { id: "f4", parent_id: null, name: "Personal space", description: "Ideas worth keeping close.", topic: "Personal", icon: "✺", banner_url: null, profile_url: null },
];
const sampleTags: TagItem[] = [
  { id: "t1", name: "Inspiration", description: "Ideas and references worth returning to", color: "violet" },
  { id: "t2", name: "In progress", description: "Things currently moving forward", color: "blue" },
  { id: "t3", name: "Important", description: "The details that matter most", color: "orange" },
  { id: "t4", name: "Research", description: "Notes, findings, and discoveries", color: "green" },
];
const sampleNotes: NoteItem[] = [
  { id: "n1", folder_id: "f1", title: "The big picture", content: "# The big picture\n\nWe’re building a studio identity that feels quietly confident. A place where thoughtful work and curious people meet.\n\n## What matters\n- [x] Define the core feeling\n- [ ] Gather visual references\n- [ ] Explore a new color language\n\nStart with [[Visual language]] and bring the best ideas into [[Launch checklist]].", status: "in-progress", due_date: null, is_pinned: true, tag_ids: ["t2", "t3"], created_at: now, updated_at: now },
  { id: "n2", folder_id: "f2", title: "Visual language", content: "# Visual language\n\nA balance of structure and softness. Open space, natural light, and tactile details. The work should speak for itself.\n\n- [ ] Build the moodboard\n- [ ] Shortlist typefaces\n- [ ] Test the palette\n\nSee [[The big picture]] for the larger direction.", status: "idea", due_date: null, is_pinned: false, tag_ids: ["t1", "t4"], created_at: now, updated_at: now },
  { id: "n3", folder_id: "f3", title: "Launch checklist", content: "# Launch checklist\n\nA simple path to launch, one meaningful milestone at a time.\n\n- [x] Align on the vision\n- [ ] Finalize identity system\n- [ ] Prepare the website\n- [ ] Share with the world\n\nKeep [[The big picture]] close as decisions take shape.", status: "in-progress", due_date: null, is_pinned: false, tag_ids: ["t2"], created_at: now, updated_at: now },
  { id: "n4", folder_id: "f4", title: "Little things to remember", content: "# Little things to remember\n\nMake room for the ideas that arrive unexpectedly.\n\n- [ ] Take a walk without a destination\n- [ ] Write down what feels interesting", status: "idea", due_date: null, is_pinned: false, tag_ids: ["t1"], created_at: now, updated_at: now },
];
const tagTone: Record<string, string> = { violet: "tag-violet", blue: "tag-blue", orange: "tag-orange", green: "tag-green", pink: "tag-pink", gray: "tag-gray" };
const statusLabels: Record<string, string> = { idea: "Ideas", "in-progress": "In progress", done: "Done" };
const uuid = () => crypto.randomUUID();
const formatDate = (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const excerpt = (content: string) => content.replace(/\[\[|\]\]|^#+\s|^- \[[ x]\]\s/gm, "").replace(/\s+/g, " ").trim();

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Forma — Your project workspace" },
    { name: "description", content: "Plan projects, connect ideas, and keep every note in its place with Forma." },
    { property: "og:title", content: "Forma — Your project workspace" },
    { property: "og:description", content: "Plan projects, connect ideas, and keep every note in its place with Forma." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Workspace,
});

function Workspace() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>(sampleFolders);
  const [notes, setNotes] = useState<NoteItem[]>(sampleNotes);
  const [tags, setTags] = useState<TagItem[]>(sampleTags);
  const [view, setView] = useState<View>("home");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>(["f1"]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [display, setDisplay] = useState<"grid" | "list" | "board">("grid");
  const [modal, setModal] = useState<"folder" | "tag" | "auth" | "settings" | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", topic: "", icon: "✳", color: "violet" });
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState("light");
  const [accent, setAccent] = useState("violet");
  const [customFirst, setCustomFirst] = useState("#6258d9");
  const [customSecond, setCustomSecond] = useState("#da83be");
  const [imageUrls, setImageUrls] = useState<Record<string,string>>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTheme(localStorage.getItem("forma-theme") || "light");
    setAccent(localStorage.getItem("forma-accent") || "violet");
    setCustomFirst(localStorage.getItem("forma-custom-first") || "#6258d9");
    setCustomSecond(localStorage.getItem("forma-custom-second") || "#da83be");
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setReady(true); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setReady(true); });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
    document.documentElement.style.setProperty("--custom-first", hexToOklch(customFirst));
    document.documentElement.style.setProperty("--custom-second", hexToOklch(customSecond));
    localStorage.setItem("forma-theme", theme); localStorage.setItem("forma-accent", accent);
    localStorage.setItem("forma-custom-first", customFirst); localStorage.setItem("forma-custom-second", customSecond);
  }, [theme, accent, customFirst, customSecond]);
  useEffect(() => {
    if (!ready) return;
    if (!user) { setFolders(sampleFolders); setNotes(sampleNotes); setTags(sampleTags); setImageUrls({}); return; }
    let active = true;
    Promise.all([
      supabase.from("folders").select("*").order("created_at"),
      supabase.from("notes").select("*").order("updated_at", { ascending: false }),
      supabase.from("tags").select("*").order("created_at"),
    ]).then(([f,n,t]) => {
      if (!active) return;
      if (f.error || n.error || t.error) { toast.error("Couldn't load your workspace"); return; }
      setFolders(f.data || []); setNotes(n.data || []); setTags(t.data || []); setView("home"); setSelectedFolder(null); setSelectedNote(null);
      const paths = (f.data || []).flatMap(item => [item.banner_url, item.profile_url]).filter((path): path is string => !!path);
      if (paths.length) supabase.storage.from("workspace-images").createSignedUrls(paths, 3600).then(({ data }) => {
        if (active && data) setImageUrls(Object.fromEntries(data.filter(row => row.signedUrl).map(row => [row.path, row.signedUrl])));
      });
    });
    return () => { active = false; };
  }, [user?.id, ready]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, []);

  const activeFolder = folders.find(f => f.id === selectedFolder);
  const activeNote = notes.find(n => n.id === selectedNote);
  const filteredNotes = useMemo(() => {
    if (view === "folder") return notes.filter(n => n.folder_id === selectedFolder);
    if (view === "pinned") return notes.filter(n => n.is_pinned);
    return [...notes].sort((a,b) => b.updated_at.localeCompare(a.updated_at));
  }, [notes, view, selectedFolder]);
  const childFolders = folders.filter(f => f.parent_id === selectedFolder);
  const navigate = (next: View, folderId: string | null = null, noteId: string | null = null) => {
    setView(next); setSelectedFolder(folderId); setSelectedNote(noteId); setSidebarOpen(false); setSearchOpen(false);
  };
  const openNote = (id: string) => { const note = notes.find(n => n.id === id); navigate("note", note?.folder_id || null, id); };
  const mutationError = (error: { message: string } | null) => { if (error) { toast.error(error.message); return true; } return false; };
  async function createNote(folderId: string | null = view === "folder" ? selectedFolder : null) {
    const item: NoteItem = { id: uuid(), folder_id: folderId, title: "Untitled note", content: "", status: "idea", due_date: null, is_pinned: false, tag_ids: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (user) { const { error } = await supabase.from("notes").insert({ ...item, owner_id: user.id }); if (mutationError(error)) return; }
    setNotes(current => [item, ...current]); openNoteDirect(item);
  }
  function openNoteDirect(item: NoteItem) { navigate("note", item.folder_id, item.id); }
  function updateNote(id: string, patch: Partial<NoteItem>, debounce = false) {
    setNotes(current => current.map(n => n.id === id ? { ...n, ...patch, updated_at: new Date().toISOString() } : n));
    if (!user) return;
    const save = async () => {
      const { error } = await supabase.from("notes").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) toast.error("Could not save note");
    };
    if (debounce) { if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current); noteSaveTimer.current = setTimeout(save, 600); }
    else void save();
  }
  async function deleteNote(id: string) {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    if (user) { const { error } = await supabase.from("notes").delete().eq("id",id); if (mutationError(error)) return; }
    setNotes(current => current.filter(n => n.id !== id)); navigate(selectedFolder ? "folder" : "all", selectedFolder); toast.success("Note deleted");
  }
  function openFolderModal(folderId: string | null = null) {
    const f = folders.find(item => item.id === folderId);
    setEditingFolder(f?.id || null); setForm({ name: f?.name || "", description: f?.description || "", topic: f?.topic || "", icon: f?.icon || "✳", color: "violet" }); setModal("folder");
  }
  async function saveFolder() {
    if (!form.name.trim()) return toast.error("Give your folder a name");
    const patch = { name: form.name.trim(), description: form.description, topic: form.topic, icon: form.icon || "✳" };
    if (editingFolder) {
      if (user) { const { error } = await supabase.from("folders").update(patch).eq("id",editingFolder); if (mutationError(error)) return; }
      setFolders(current => current.map(f => f.id === editingFolder ? { ...f, ...patch } : f));
    } else {
      const item: FolderItem = { id: uuid(), parent_id: view === "folder" ? selectedFolder : null, ...patch, banner_url: null, profile_url: null };
      if (user) { const { error } = await supabase.from("folders").insert({ ...item, owner_id: user.id }); if (mutationError(error)) return; }
      setFolders(current => [...current, item]);
      if (item.parent_id) setExpanded(current => [...new Set([...current, item.parent_id as string])]);
      navigate("folder", item.id);
    }
    setModal(null); toast.success(editingFolder ? "Folder updated" : "Folder created");
  }
  async function deleteFolder(id: string) {
    if (!confirm("Delete this folder and its subfolders? Notes inside will be kept in All notes.")) return;
    if (user) { const { error } = await supabase.from("folders").delete().eq("id",id); if (mutationError(error)) return; }
    const descendants = (parent: string): string[] => folders.filter(f => f.parent_id === parent).flatMap(f => [f.id, ...descendants(f.id)]);
    const ids = [id, ...descendants(id)]; setFolders(current => current.filter(f => !ids.includes(f.id)));
    setNotes(current => current.map(n => n.folder_id && ids.includes(n.folder_id) ? { ...n, folder_id: null } : n)); navigate("home"); toast.success("Folder deleted");
  }
  function openTagModal(id: string | null = null) {
    const tag = tags.find(t => t.id === id); setEditingTag(id);
    setForm({ name: tag?.name || "", description: tag?.description || "", topic: "", icon: "", color: tag?.color || "violet" }); setModal("tag");
  }
  async function saveTag() {
    if (!form.name.trim()) return toast.error("Give your tag a name");
    const patch = { name: form.name.trim(), description: form.description, color: form.color };
    if (editingTag) {
      if (user) { const { error } = await supabase.from("tags").update(patch).eq("id",editingTag); if (mutationError(error)) return; }
      setTags(current => current.map(t => t.id === editingTag ? { ...t, ...patch } : t));
    } else {
      const item: TagItem = { id: uuid(), ...patch };
      if (user) { const { error } = await supabase.from("tags").insert({ ...item, owner_id: user.id }); if (mutationError(error)) return; }
      setTags(current => [...current,item]);
    }
    setModal(null); toast.success(editingTag ? "Tag updated" : "Tag created");
  }
  async function deleteTag(id: string) {
    if (!confirm("Delete this tag?")) return;
    if (user) { const { error } = await supabase.from("tags").delete().eq("id",id); if (mutationError(error)) return; }
    setTags(current => current.filter(t => t.id !== id));
    const affected = notes.filter(n => n.tag_ids.includes(id));
    setNotes(current => current.map(n => ({ ...n, tag_ids: n.tag_ids.filter(t => t !== id) })));
    if (user) await Promise.all(affected.map(n => supabase.from("notes").update({ tag_ids: n.tag_ids.filter(t => t !== id) }).eq("id",n.id)));
    toast.success("Tag deleted");
  }
  async function uploadImage(kind: "banner" | "profile", file: File) {
    if (!selectedFolder) return;
    if (!user) return toast.info("Sign in to upload images to your workspace");
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return toast.error("Choose an image under 5 MB");
    setUploading(true);
    const path = `${user.id}/${uuid()}.${file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg"}`;
    const { error } = await supabase.storage.from("workspace-images").upload(path,file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const column = kind === "banner" ? "banner_url" : "profile_url";
    const { error: updateError } = await supabase.from("folders").update({ [column]: path }).eq("id",selectedFolder);
    if (updateError) { toast.error(updateError.message); setUploading(false); return; }
    const { data } = await supabase.storage.from("workspace-images").createSignedUrl(path, 3600);
    if (data?.signedUrl) setImageUrls(current => ({ ...current, [path]: data.signedUrl }));
    setFolders(current => current.map(f => f.id === selectedFolder ? { ...f, [column]: path } : f)); setUploading(false); toast.success("Image updated");
  }
  async function authSubmit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    const { error, data } = authMode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (authMode === "signup" && !data.session) toast.success("Check your email to confirm your account");
    else { setModal(null); toast.success("Welcome to your workspace"); }
  }
  async function googleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error(result.error.message);
    else if (!result.redirected) setModal(null);
  }
  const searchResults = [...folders.filter(f => `${f.name} ${f.description}`.toLowerCase().includes(search.toLowerCase())).map(f => ({ id: f.id, name: f.name, kind: "folder" })), ...notes.filter(n => `${n.title} ${n.content}`.toLowerCase().includes(search.toLowerCase())).map(n => ({ id: n.id, name: n.title, kind: "note" }))].slice(0, 12);
  const folderTree = (parent: string | null, depth = 0): React.ReactNode => folders.filter(f => f.parent_id === parent).map(f => {
    const children = folders.some(child => child.parent_id === f.id);
    const isExpanded = expanded.includes(f.id);
    return <div key={f.id}>
      <div className={`folder-tree-row ${selectedFolder === f.id && view === "folder" ? "selected" : ""}`} style={{ paddingLeft: `${10 + depth * 15}px` }}>
        <Button variant="ghost" size="icon" className="tree-chevron" aria-label={isExpanded ? "Collapse folder" : "Expand folder"} onClick={() => setExpanded(current => isExpanded ? current.filter(id => id !== f.id) : [...current,f.id])}>{children ? isExpanded ? <ChevronDown /> : <ChevronRight /> : <span className="tree-spacer" />}</Button>
        <Button variant="ghost" className="folder-tree-name" onClick={() => navigate("folder", f.id)}><span className="folder-glyph">{f.icon}</span><span className="truncate">{f.name}</span></Button>
      </div>
      {isExpanded && folderTree(f.id, depth + 1)}
    </div>;
  });
  const noteCard = (note: NoteItem) => {
    const count = (note.content.match(/^- \[ \]/gm) || []).length;
    return <div key={note.id} className="note-card soft-panel enter" role="button" tabIndex={0} onClick={() => openNote(note.id)} onKeyDown={e => { if (e.key === "Enter") openNote(note.id); }}>
      <div className="note-card-top"><span className="note-card-icon"><FileText size={17} /></span>{note.is_pinned && <Pin size={14} className="text-primary" />}</div>
      <h3>{note.title || "Untitled note"}</h3><p>{excerpt(note.content) || "A blank page for new ideas..."}</p>
      <div className="note-card-bottom"><span>{formatDate(note.updated_at)}</span><span className="flex items-center gap-1">{count > 0 && <><Circle size={12}/>{count} tasks</>}{note.folder_id && <><span className="mx-1">·</span><Folder size={12}/>{folders.find(f => f.id === note.folder_id)?.name || "Folder"}</>}</span></div>
    </div>;
  };
  const noteRow = (note: NoteItem) => <div key={note.id} role="button" tabIndex={0} className="note-row" onClick={() => openNote(note.id)} onKeyDown={e => { if (e.key === "Enter") openNote(note.id); }}><span className="note-card-icon"><FileText size={16}/></span><div className="min-w-0 flex-1"><strong className="truncate block">{note.title}</strong><span className="text-xs text-muted-foreground truncate block">{excerpt(note.content) || "Empty note"}</span></div><span className="status-label">{statusLabels[note.status]}</span><span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(note.updated_at)}</span><ChevronRight size={16} className="text-muted-foreground" /></div>;
  const collection = (items: NoteItem[]) => display === "board" ? <div className="board-grid">{["idea","in-progress","done"].map(status => <div key={status} className="board-column"><div className="board-title"><span className={`status-dot ${status}`}/>{statusLabels[status]} <span className="text-muted-foreground">{items.filter(n => n.status === status).length}</span></div><div className="board-items">{items.filter(n => n.status === status).map(noteCard)}</div></div>)}</div> : display === "list" ? <div className="list-stack soft-panel">{items.map(noteRow)}</div> : <div className="notes-grid">{items.map(noteCard)}</div>;
  const viewSwitch = <div className="view-switch"><Button variant="ghost" size="icon" aria-label="Grid view" title="Grid view" className={display === "grid" ? "active" : ""} onClick={() => setDisplay("grid")}><Grid2X2/></Button><Button variant="ghost" size="icon" aria-label="List view" title="List view" className={display === "list" ? "active" : ""} onClick={() => setDisplay("list")}><List/></Button><Button variant="ghost" size="icon" aria-label="Board view" title="Board view" className={display === "board" ? "active" : ""} onClick={() => setDisplay("board")}><LayoutGrid/></Button></div>;

  return <div className="app-shell">
    <Toaster position="bottom-right" richColors />
    {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark">✳</div><span>forma<span className="brand-period">.</span></span><Button variant="ghost" size="icon" className="sidebar-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X/></Button></div>
      <Button variant="ghost" className="sidebar-search" onClick={() => { setSearchOpen(true); setSidebarOpen(false); }}><Search size={17}/><span>Search anything...</span><kbd>⌘ K</kbd></Button>
      <div className="sidebar-content thin-scroll">
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav">
          <Button variant="ghost" className={`nav-item ${view === "home" ? "active" : ""}`} onClick={() => navigate("home")}><LayoutGrid/>Overview</Button>
          <Button variant="ghost" className={`nav-item ${view === "all" ? "active" : ""}`} onClick={() => navigate("all")}><FileText/>All notes <span className="nav-count">{notes.length}</span></Button>
          <Button variant="ghost" className={`nav-item ${view === "recent" ? "active" : ""}`} onClick={() => navigate("recent")}><Clock3/>Recent</Button>
          <Button variant="ghost" className={`nav-item ${view === "pinned" ? "active" : ""}`} onClick={() => navigate("pinned")}><Bookmark/>Pinned</Button>
        </nav>
        <div className="sidebar-section-head"><span>FOLDERS</span><Button variant="ghost" size="icon" title="New folder" aria-label="New folder" onClick={() => openFolderModal()}><Plus/></Button></div>
        <div className="folder-tree">{folderTree(null)}{folders.length === 0 && <span className="sidebar-empty">No folders yet</span>}</div>
        <div className="sidebar-section-head tags-head"><span>TAGS</span><Button variant="ghost" size="icon" title="New tag" aria-label="New tag" onClick={() => openTagModal()}><Plus/></Button></div>
        <div className="sidebar-tags">{tags.slice(0,5).map(tag => <Button variant="ghost" key={tag.id} className="sidebar-tag" onClick={() => navigate("tags")}><span className={`tag-dot ${tagTone[tag.color] || "tag-gray"}`}/>{tag.name}</Button>)}<Button variant="ghost" className="sidebar-tag all-tags" onClick={() => navigate("tags")}><Hash size={15}/> Manage tags</Button></div>
      </div>
      <div className="sidebar-bottom"><Button variant="ghost" className="sidebar-bottom-action" onClick={() => setModal("settings")}><Settings2 size={17}/> Appearance</Button><Button variant="ghost" className="account-button" onClick={() => user ? void supabase.auth.signOut() : setModal("auth")}><span className="avatar">{user?.email?.[0]?.toUpperCase() || "G"}</span><span className="account-copy"><strong>{user?.email?.split("@")[0] || "Guest workspace"}</strong><small>{user ? "Sign out" : "Sign in to sync"}</small></span><MoreHorizontal size={17}/></Button></div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><Button variant="ghost" size="icon" aria-label="Open menu" className="mobile-menu" onClick={() => setSidebarOpen(true)}><Menu/></Button><span className="breadcrumb-root" onClick={() => navigate("home")}>Workspace</span><ChevronRight size={14}/><span className="breadcrumb-current">{view === "folder" ? activeFolder?.name : view === "note" ? activeNote?.title : ({ home: "Overview", all: "All notes", recent: "Recent", pinned: "Pinned", tags: "Tags" } as Record<string,string>)[view]}</span></div><div className="topbar-actions">{!user && <Button variant="ghost" className="sync-link" onClick={() => setModal("auth")}>Sign in to sync</Button>}<Button variant="ghost" size="icon" aria-label="Search" title="Search" onClick={() => setSearchOpen(true)}><Search/></Button><Button className="new-note-button accent-fill" onClick={() => void createNote()}><Plus size={17}/> <span>New note</span></Button></div></header>
      <div className="content-scroll thin-scroll"><div className="content-inner">
        {view === "home" && <div className="enter">
          <div className="welcome-line"><div><div className="eyebrow">YOUR CREATIVE SPACE <span className="eyebrow-line" /></div><h1>Good things start <em>here.</em></h1><p>Everything you need to make your next idea happen.</p></div><div className="welcome-date"><CalendarDays size={16}/>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</div></div>
          <div className="overview-feature" onClick={() => folders[0] && navigate("folder", folders[0].id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter" && folders[0]) navigate("folder", folders[0].id); }}><img src={folders[0]?.banner_url && folders[0].banner_url !== "sample" ? imageUrls[folders[0].banner_url] || banner : banner} alt="Contemporary architectural courtyard" /><div className="feature-shade"/><div className="feature-content"><span className="feature-label"><Sparkles size={14}/> FEATURED PROJECT</span><h2>{folders[0]?.name || "Your next big thing"}</h2><p>{folders[0]?.description || "Create a folder to bring your ideas together."}</p><span className="feature-link">Explore project <ArrowRight size={17}/></span></div></div>
          <div className="section-heading"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Recent notes</h2></div><Button variant="ghost" className="subtle-link" onClick={() => navigate("all")}>View all <ArrowRight size={16}/></Button></div>
          {notes.length ? <div className="notes-grid home-notes">{[...notes].sort((a,b) => b.updated_at.localeCompare(a.updated_at)).slice(0,3).map(noteCard)}</div> : <div className="empty-state soft-panel"><FileText/><h3>A fresh page awaits</h3><p>Start with a note and see where it takes you.</p><Button onClick={() => void createNote()}><Plus/> New note</Button></div>}
          <div className="section-heading projects-heading"><div><span className="eyebrow">YOUR SPACES</span><h2>Projects & folders</h2></div><Button variant="ghost" className="subtle-link" onClick={() => openFolderModal()}><Plus size={17}/> New folder</Button></div>
          <div className="folder-grid">{folders.filter(f => !f.parent_id).map(f => <div key={f.id} role="button" tabIndex={0} className="folder-tile soft-panel" onClick={() => navigate("folder",f.id)} onKeyDown={e => {if(e.key === "Enter") navigate("folder",f.id);}}><span className="folder-tile-icon">{f.icon}</span><div><h3>{f.name}</h3><p>{f.topic || "Folder"} · {notes.filter(n => n.folder_id === f.id).length} notes</p></div><ArrowRight size={17}/></div>)}<Button variant="ghost" className="folder-tile folder-add" onClick={() => openFolderModal()}><span className="folder-tile-icon"><Plus/></span><span>Create a folder</span></Button></div>
        </div>}
        {view === "folder" && activeFolder && <div className="enter"><div className="folder-cover"><img src={activeFolder.banner_url === "sample" ? banner : activeFolder.banner_url ? imageUrls[activeFolder.banner_url] || banner : banner} alt="Folder banner" /><div className="cover-overlay"/><Button variant="ghost" className="cover-edit" onClick={() => fileRef.current?.click()}><ImagePlus size={16}/>{uploading ? "Uploading..." : "Change cover"}</Button></div><div className="folder-intro"><div className="folder-identity"><Button variant="ghost" className="folder-profile" title="Change profile image" onClick={() => { if (fileRef.current) { fileRef.current.dataset.kind = "profile"; fileRef.current.click(); } }}>{activeFolder.profile_url && imageUrls[activeFolder.profile_url] ? <img src={imageUrls[activeFolder.profile_url]} alt="Folder profile"/> : activeFolder.icon}</Button><div className="folder-intro-main"><div className="folder-path"><Button variant="ghost" onClick={() => activeFolder.parent_id ? navigate("folder",activeFolder.parent_id) : navigate("home")}>{activeFolder.parent_id ? folders.find(f => f.id === activeFolder.parent_id)?.name : "My workspace"}</Button><ChevronRight size={13}/><span>{activeFolder.name}</span></div><h1>{activeFolder.name}</h1><p>{activeFolder.description || "A place for your ideas to grow."}</p><span className="topic-chip"><Sparkles size={13}/>{activeFolder.topic || "Add a topic"}</span></div></div><div className="folder-intro-actions"><Button variant="outline" onClick={() => openFolderModal(activeFolder.id)}><Settings2 size={15}/> Edit folder</Button><Button variant="ghost" size="icon" aria-label="Delete folder" title="Delete folder" onClick={() => void deleteFolder(activeFolder.id)}><Trash2/></Button></div></div>
          <div className="folder-stats"><span><FolderClosed size={15}/>{childFolders.length} subfolders</span><span><FileText size={15}/>{filteredNotes.length} notes</span><span><Circle size={15}/>{filteredNotes.reduce((sum,n) => sum + (n.content.match(/^- \[ \]/gm)||[]).length,0)} open tasks</span></div>
          <div className="section-heading folders-section"><div><span className="eyebrow">ORGANIZE THE DETAILS</span><h2>Subfolders</h2></div><Button variant="ghost" className="subtle-link" onClick={() => openFolderModal()}><Plus size={17}/> New subfolder</Button></div>
          {childFolders.length ? <div className="folder-grid">{childFolders.map(f => <div key={f.id} className="folder-tile soft-panel" role="button" tabIndex={0} onClick={() => navigate("folder",f.id)} onKeyDown={e => { if(e.key === "Enter") navigate("folder",f.id); }}><span className="folder-tile-icon">{f.icon}</span><div><h3>{f.name}</h3><p>{f.description || f.topic || "Subfolder"}</p></div><ArrowRight size={17}/></div>)}</div> : <p className="quiet-empty">No subfolders yet.</p>}
          <div className="section-heading notes-heading"><div><span className="eyebrow">THOUGHTS IN PROGRESS</span><h2>Notes <span className="heading-count">{filteredNotes.length}</span></h2></div><div className="heading-actions">{viewSwitch}<Button className="accent-fill" onClick={() => void createNote(activeFolder.id)}><Plus size={16}/> New note</Button></div></div>
          {filteredNotes.length ? collection(filteredNotes) : <div className="empty-state soft-panel"><FileText/><h3>Nothing here yet</h3><p>Give this folder its first note.</p><Button onClick={() => void createNote(activeFolder.id)}><Plus/> New note</Button></div>}
        </div>}
        {(view === "all" || view === "recent" || view === "pinned") && <div className="enter"><div className="page-heading"><div className="eyebrow">YOUR WORKSPACE</div><h1>{view === "all" ? "All notes" : view === "recent" ? "Recently touched" : "Pinned notes"}</h1><p>{view === "pinned" ? "The things you always want close at hand." : "Every thought, plan, and possibility in one place."}</p></div><div className="section-heading collection-heading"><h2>{filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}</h2><div className="heading-actions">{viewSwitch}<Button className="accent-fill" onClick={() => void createNote()}><Plus size={16}/> New note</Button></div></div>{filteredNotes.length ? collection(filteredNotes) : <div className="empty-state soft-panel"><FileText/><h3>Nothing here yet</h3><p>Start with a new note.</p><Button onClick={() => void createNote()}><Plus/> New note</Button></div>}</div>}
        {view === "tags" && <div className="enter"><div className="page-heading"><div className="eyebrow">A LANGUAGE OF YOUR OWN</div><h1>Tags</h1><p>Give your ideas context with labels that mean something to you.</p></div><div className="section-heading collection-heading"><h2>Your tags <span className="heading-count">{tags.length}</span></h2><Button className="accent-fill" onClick={() => openTagModal()}><Plus size={16}/> New tag</Button></div><div className="tag-grid">{tags.map(tag => <div className="tag-item soft-panel" key={tag.id}><div className="tag-item-head"><span className={`tag-badge ${tagTone[tag.color] || "tag-gray"}`}><span className="tag-dot"/> {tag.name}</span><div><Button variant="ghost" size="icon" title="Edit tag" aria-label={`Edit ${tag.name}`} onClick={() => openTagModal(tag.id)}><Settings2 size={16}/></Button><Button variant="ghost" size="icon" title="Delete tag" aria-label={`Delete ${tag.name}`} onClick={() => void deleteTag(tag.id)}><Trash2 size={16}/></Button></div></div><p>{tag.description || "No description yet"}</p><small>{notes.filter(n => n.tag_ids.includes(tag.id)).length} notes</small></div>)}</div></div>}
        {view === "note" && activeNote && <NoteEditor key={activeNote.id} note={activeNote} folders={folders} notes={notes} tags={tags} onChange={patch => updateNote(activeNote.id,patch,true)} onAction={patch => updateNote(activeNote.id,patch)} onDelete={() => void deleteNote(activeNote.id)} onOpenNote={openNote} onOpenFolder={id => navigate("folder",id)} onBack={() => navigate(activeNote.folder_id ? "folder" : "all", activeNote.folder_id)} />}
      </div></div>
    </main>
    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if(file) void uploadImage(e.target.dataset.kind === "profile" ? "profile" : "banner", file); e.target.value = ""; e.target.dataset.kind = "banner"; }} />
    {searchOpen && <div className="command-backdrop" onMouseDown={() => setSearchOpen(false)}><div className="command-box glass" onMouseDown={e => e.stopPropagation()}><div className="command-input"><Search size={21}/><input autoFocus placeholder="Search notes and folders..." value={search} onChange={e => setSearch(e.target.value)}/><kbd>ESC</kbd></div><div className="command-results thin-scroll">{searchResults.length ? searchResults.map(result => <Button variant="ghost" key={result.id} className="command-result" onClick={() => result.kind === "folder" ? navigate("folder",result.id) : openNote(result.id)}>{result.kind === "folder" ? <Folder size={17}/> : <FileText size={17}/>}<span>{result.name}</span><ArrowRight size={15}/></Button>) : <p className="quiet-empty">No matches found.</p>}</div><div className="command-footer"><span><kbd>↵</kbd> to open</span><span><kbd>ESC</kbd> to close</span></div></div></div>}
    <Dialog open={modal === "folder"} onOpenChange={open => !open && setModal(null)}><DialogContent className="dialog-surface"><DialogHeader><DialogTitle>{editingFolder ? "Edit folder" : selectedFolder && view === "folder" ? "New subfolder" : "New folder"}</DialogTitle></DialogHeader><div className="modal-fields"><label>Folder name<Input autoFocus placeholder="e.g. New project" value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label><label>Description<Textarea placeholder="What belongs here?" value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></label><div className="two-fields"><label>Topic tag<Input placeholder="e.g. Design" value={form.topic} onChange={e => setForm({...form,topic:e.target.value})}/></label><label>Profile symbol<Input maxLength={2} value={form.icon} onChange={e => setForm({...form,icon:e.target.value})}/></label></div><Button className="accent-fill w-full" onClick={() => void saveFolder()}>{editingFolder ? "Save changes" : "Create folder"}</Button></div></DialogContent></Dialog>
    <Dialog open={modal === "tag"} onOpenChange={open => !open && setModal(null)}><DialogContent className="dialog-surface"><DialogHeader><DialogTitle>{editingTag ? "Edit tag" : "New tag"}</DialogTitle></DialogHeader><div className="modal-fields"><label>Tag name<Input autoFocus placeholder="e.g. To review" value={form.name} onChange={e => setForm({...form,name:e.target.value})}/></label><label>What does it mean?<Textarea placeholder="A little context for this tag..." value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></label><label>Color</label><div className="color-options">{["violet","blue","green","orange","pink","gray"].map(color => <Button key={color} variant="ghost" size="icon" className={`color-option ${tagTone[color]} ${form.color === color ? "chosen" : ""}`} title={color} aria-label={`${color} color`} onClick={() => setForm({...form,color})}>{form.color === color && <Check size={15}/>}</Button>)}</div><Button className="accent-fill w-full" onClick={() => void saveTag()}>{editingTag ? "Save changes" : "Create tag"}</Button></div></DialogContent></Dialog>
    <Dialog open={modal === "auth"} onOpenChange={open => !open && setModal(null)}><DialogContent className="dialog-surface auth-dialog"><div className="auth-logo">✳</div><DialogHeader><DialogTitle>{authMode === "login" ? "Welcome back" : "Make space for ideas"}</DialogTitle></DialogHeader><p className="auth-subtitle">{authMode === "login" ? "Sign in to find your workspace exactly as you left it." : "Create your account to save and sync your work."}</p><form className="modal-fields" onSubmit={authSubmit}><label>Email<Input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<Input type="password" required minLength={6} autoComplete={authMode === "login" ? "current-password" : "new-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters"/></label><Button type="submit" className="accent-fill w-full" disabled={busy}>{busy ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}</Button></form><div className="auth-divider">or</div><Button variant="outline" className="w-full" onClick={() => void googleSignIn()}>Continue with Google</Button><p className="auth-switch">{authMode === "login" ? "New to Forma?" : "Already have an account?"} <Button variant="link" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "Create an account" : "Sign in"}</Button></p></DialogContent></Dialog>
    <Dialog open={modal === "settings"} onOpenChange={open => !open && setModal(null)}><DialogContent className="dialog-surface"><DialogHeader><DialogTitle>Appearance</DialogTitle></DialogHeader><div className="modal-fields"><label>Theme</label><div className="appearance-segment"><Button variant="ghost" className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}><Sun size={17}/> Light</Button><Button variant="ghost" className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}><Moon size={17}/> Dark</Button></div><label>Accent gradient</label><div className="accent-options">{["violet","ocean","sunset","forest","rose","custom"].map(a => <Button key={a} variant="ghost" className={`accent-choice accent-${a} ${accent === a ? "chosen" : ""}`} onClick={() => setAccent(a)} title={a}><span className="accent-preview"/>{a === "custom" ? "Custom" : a[0].toUpperCase()+a.slice(1)}</Button>)}</div>{accent === "custom" && <div className="custom-colors"><label>Start<input type="color" value={customFirst} onChange={e => setCustomFirst(e.target.value)}/></label><label>End<input type="color" value={customSecond} onChange={e => setCustomSecond(e.target.value)}/></label></div>}</div></DialogContent></Dialog>
  </div>;
}

function hexToOklch(hex: string) { return hex; }

function NoteEditor({ note, notes, folders, tags, onChange, onAction, onDelete, onOpenNote, onOpenFolder, onBack }: { note: NoteItem; notes: NoteItem[]; folders: FolderItem[]; tags: TagItem[]; onChange: (patch: Partial<NoteItem>) => void; onAction: (patch: Partial<NoteItem>) => void; onDelete: () => void; onOpenNote: (id: string) => void; onOpenFolder: (id: string) => void; onBack: () => void }) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [linkQuery, setLinkQuery] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const backlinks = notes.filter(n => n.id !== note.id && n.content.toLowerCase().includes(`[[${note.title.toLowerCase()}]]`));
  const tasks = [...note.content.matchAll(/^- \[([ x])\] (.+)$/gm)];
  const completed = tasks.filter(match => match[1] === "x").length;
  const linkTargets = [...notes.filter(n => n.id !== note.id).map(n => ({ id:n.id,name:n.title,type:"note" })),...folders.map(f => ({id:f.id,name:f.name,type:"folder"}))].filter(item => item.name.toLowerCase().includes((linkQuery || "").toLowerCase())).slice(0,6);
  function handleContent(value: string, position: number) {
    onChange({ content: value }); setCursor(position);
    const before = value.slice(0,position); const match = before.match(/\[\[([^\]]*)$/); setLinkQuery(match ? match[1] : null);
  }
  function insertLink(name: string) {
    const before = note.content.slice(0,cursor); const start = before.lastIndexOf("[[");
    if (start < 0) return;
    const value = note.content.slice(0,start) + `[[${name}]]` + note.content.slice(cursor);
    onChange({ content: value }); setLinkQuery(null); requestAnimationFrame(() => contentRef.current?.focus());
  }
  function renderContent() {
    return note.content.split("\n").map((line,index) => {
      const parts = line.split(/(\[\[[^\]]+\]\])/g).map((part,i) => {
        if (!part.startsWith("[[") || !part.endsWith("]]")) return part;
        const name = part.slice(2,-2); const target = notes.find(n => n.title.toLowerCase() === name.toLowerCase()) || folders.find(f => f.name.toLowerCase() === name.toLowerCase());
        return <Button key={i} variant="link" className="inline-link" disabled={!target} onClick={() => target && ("content" in target ? onOpenNote(target.id) : onOpenFolder(target.id))}><Link2 size={13}/>{name}</Button>;
      });
      if (line.startsWith("# ")) return <h2 key={index}>{parts.map((p,i) => i === 0 && typeof p === "string" ? p.slice(2) : p)}</h2>;
      if (line.startsWith("## ")) return <h3 key={index}>{parts.map((p,i) => i === 0 && typeof p === "string" ? p.slice(3) : p)}</h3>;
      const task = line.match(/^- \[([ x])\] (.*)$/);
      if (task) return <div key={index} className="preview-task"><Button variant="ghost" size="icon" aria-label={task[1] === "x" ? "Mark incomplete" : "Mark complete"} onClick={() => { const lines = note.content.split("\n"); lines[index] = `- [${task[1] === "x" ? " " : "x"}] ${task[2]}`; onAction({ content: lines.join("\n") }); }}>{task[1] === "x" ? <Check size={15}/> : <Circle size={15}/>}</Button><span className={task[1] === "x" ? "completed" : ""}>{task[2]}</span></div>;
      if (line.startsWith("- ")) return <p key={index} className="preview-bullet">• {parts.map((p,i) => i === 0 && typeof p === "string" ? p.slice(2) : p)}</p>;
      return <p key={index}>{parts.length ? parts : "\u00a0"}</p>;
    });
  }
  return <div className="editor enter"><div className="editor-toolbar"><Button variant="ghost" onClick={onBack}><ArrowLeft size={17}/> Back</Button><div><span className="save-state"><Check size={13}/> Saved</span><Button variant="ghost" size="icon" title={note.is_pinned ? "Unpin note" : "Pin note"} aria-label={note.is_pinned ? "Unpin note" : "Pin note"} onClick={() => onAction({is_pinned:!note.is_pinned})}><Pin className={note.is_pinned ? "text-primary" : ""}/></Button><Button variant="ghost" size="icon" title="Delete note" aria-label="Delete note" onClick={onDelete}><Trash2/></Button></div></div><div className="editor-body"><div className="editor-main"><div className="editor-eyebrow"><FileText size={15}/> NOTE <span>·</span> {formatDate(note.updated_at)}</div><input className="editor-title" aria-label="Note title" value={note.title} onChange={e => onChange({title:e.target.value})} placeholder="Untitled note"/><div className="editor-meta"><label><Folder size={15}/><select aria-label="Move to folder" value={note.folder_id || ""} onChange={e => onAction({folder_id:e.target.value || null})}><option value="">No folder</option>{folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select><ChevronDown size={13}/></label><label><Circle size={15}/><select aria-label="Status" value={note.status} onChange={e => onAction({status:e.target.value})}>{Object.entries(statusLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select><ChevronDown size={13}/></label><label><CalendarDays size={15}/><input type="date" aria-label="Due date" value={note.due_date || ""} onChange={e => onAction({due_date:e.target.value || null})}/></label></div><div className="editor-tagline"><Tag size={15}/>{tags.filter(t => note.tag_ids.includes(t.id)).map(t => <Button variant="ghost" key={t.id} className={`tag-badge ${tagTone[t.color] || "tag-gray"}`} onClick={() => onAction({tag_ids:note.tag_ids.filter(id => id !== t.id)})}>{t.name}<X size={12}/></Button>)}<select aria-label="Add tag" value="" onChange={e => e.target.value && onAction({tag_ids:[...note.tag_ids,e.target.value]})}><option value="">+ Add tag</option>{tags.filter(t => !note.tag_ids.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div className="editor-tabs"><Button variant="ghost" className={tab === "write" ? "active" : ""} onClick={() => setTab("write")}>Write</Button><Button variant="ghost" className={tab === "preview" ? "active" : ""} onClick={() => setTab("preview")}>Preview</Button><span>Type [[ to link a note or folder</span></div><div className="editor-writing">{tab === "write" ? <><textarea ref={contentRef} aria-label="Note content" value={note.content} onChange={e => handleContent(e.target.value,e.target.selectionStart)} onClick={e => { const target = e.target as HTMLTextAreaElement; setCursor(target.selectionStart); }} placeholder="Every great idea starts somewhere. Write anything..." spellCheck={false}/>{linkQuery !== null && <div className="link-suggestions soft-panel"><div className="suggestion-heading">LINK TO A NOTE OR FOLDER</div>{linkTargets.length ? linkTargets.map(target => <Button variant="ghost" key={target.type+target.id} onClick={() => insertLink(target.name)}>{target.type === "note" ? <FileText size={16}/> : <Folder size={16}/>} {target.name}</Button>) : <span className="suggestion-empty">No matching pages</span>}</div>}</> : <div className="note-preview">{note.content ? renderContent() : <p className="text-muted-foreground">Nothing to preview yet.</p>}</div>}</div></div><aside className="editor-side"><div className="side-block"><div className="side-block-heading"><Sparkles size={17}/> PROJECT PULSE</div><h3>{tasks.length ? `${completed} of ${tasks.length} tasks done` : "Make it happen"}</h3><p>{tasks.length ? "Small steps add up. Keep the momentum going." : "Add tasks with - [ ] to track your progress."}</p>{tasks.length > 0 && <div className="progress-track"><div style={{width:`${completed/tasks.length*100}%`}}/></div>}</div><div className="side-block"><div className="side-block-heading"><Link2 size={17}/> CONNECTIONS</div><p className="side-hint">Linked from this note</p>{[...note.content.matchAll(/\[\[([^\]]+)\]\]/g)].map((match,i) => { const target = notes.find(n => n.title.toLowerCase() === match[1].toLowerCase()) || folders.find(f => f.name.toLowerCase() === match[1].toLowerCase()); return <Button variant="ghost" key={i} className="connection-item" disabled={!target} onClick={() => target && ("content" in target ? onOpenNote(target.id) : onOpenFolder(target.id))}>{target && "content" in target ? <FileText size={15}/> : <Folder size={15}/>}<span>{match[1]}</span><ArrowRight size={14}/></Button>; })}<p className="side-hint backlink-heading">Backlinks · {backlinks.length}</p>{backlinks.map(n => <Button variant="ghost" key={n.id} className="connection-item" onClick={() => onOpenNote(n.id)}><FileText size={15}/><span>{n.title}</span><ArrowRight size={14}/></Button>)}{!backlinks.length && <p className="side-small">No notes link here yet.</p>}</div></aside></div></div>;
}
