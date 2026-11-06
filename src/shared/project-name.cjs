const RESERVED_CHARACTERS = new Set(["<", ">", ":", '"', "/", "\\", "|", "?", "*"]);

function validateProjectName(value) {
  if (typeof value !== "string") {
    throw new Error("A project name is required.");
  }

  const name = value.trim();
  const hasControlCharacter = [...name].some((character) => character.charCodeAt(0) < 32);
  const hasReservedCharacter = [...name].some((character) => RESERVED_CHARACTERS.has(character));

  if (!name || name.length > 64 || hasControlCharacter || hasReservedCharacter || name === "." || name === "..") {
    throw new Error("Project name must be 1–64 characters and cannot contain filesystem-reserved characters.");
  }

  return name;
}

module.exports = { validateProjectName };
