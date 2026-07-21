export type Replacement = { id: string; name: string; detail: string; duration: string; icon: string };

export const replacements: Replacement[] = [
  { id: "walk", name: "Take a short walk", detail: "A quick reset for your body and attention.", duration: "5 min", icon: "walk" },
  { id: "breathe", name: "Slow breathing", detail: "Create a little room between you and the urge.", duration: "2 min", icon: "breathe" },
  { id: "stretch", name: "Stretch your shoulders", detail: "Release some tension without leaving your space.", duration: "3 min", icon: "stretch" },
  { id: "water", name: "Make a glass of water", detail: "A small, physical action to change the moment.", duration: "3 min", icon: "water" },
  { id: "friend", name: "Message someone", detail: "A low-pressure way to reconnect with a person.", duration: "5 min", icon: "friend" },
];
