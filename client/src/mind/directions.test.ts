import { describe, expect, it } from "vitest";
import { askedPlace, compass, directions, doingAnswer, topicOf, farAnswer, whoAnswer, type Place } from "./directions";

const places: Place[] = [
  { name: "the pond", words: ["pond", "lake"], x: 30, z: -30 },
  { name: "the village square", words: ["square", "plaza"], x: 0, z: 0 },
  { name: "Mo", words: ["mo"], x: 2, z: 1, doing: "fishes" },
];

describe("directions from the real map", () => {
  it("answers a direct question with a true compass way", () => {
    expect(askedPlace("where is the pond?", places, null)?.name).toBe("the pond");
    expect(directions({ x: 0, z: 0 }, places[0]!)).toBe("The pond is far off to the north-east, about 42 steps, over the bridges.");
  });

  it("follows the talk: 'where is it' uses the last place named", () => {
    const topic = topicOf("Want to run to the pond with me?", places)?.name ?? null;
    expect(askedPlace("where is it?", places, topic)?.name).toBe("the pond");
    expect(askedPlace("how do I get there", places, topic)?.name).toBe("the pond");
    expect(askedPlace("where is it?", places, null)).toBeNull();
  });

  it("leaves other lines to the model", () => {
    expect(askedPlace("I love the pond", places, null)).toBeNull();
    expect(askedPlace("where were you yesterday", places, "the pond")).toBeNull();
  });

  it("says what a person nearby is doing", () => {
    expect(directions({ x: 0, z: 0 }, places[2]!)).toBe("Mo is right here. Mo fishes now.");
  });

  it("gives the eight compass words", () => {
    expect(compass({ x: 0, z: 0 }, { x: 0, z: 9 })).toBe("south");
    expect(compass({ x: 0, z: 0 }, { x: -9, z: 9 })).toBe("south-west");
  });

  it("knows the neighbours", () => {
    const people = [{ name: "Mo", title: "fisher" }, { name: "Ama", title: "market keeper" }, { name: "Pip" }];
    expect(whoAnswer("do you know mo?", people, "Pip")).toBe("Of course I know Mo, our fisher.");
    expect(whoAnswer("who lives here?", people, "Pip")).toBe("Me, Mo the fisher and Ama the market keeper. Plus visitors like you.");
    expect(whoAnswer("do you know bread?", people, "Pip")).toBeNull();
  });

  it("answers what it is doing from the sim", () => {
    expect(doingAnswer("what are you doing?", "fishes", false)).toBe("Right now? I fish.");
    expect(doingAnswer("what are you up to", "has a picnic", true)).toBe("Off to have a picnic.");
    expect(doingAnswer("nice weather", "fishes", false)).toBeNull();
  });
});

describe("farAnswer", () => {
  const way = "The pond is far off to the north-west, about 53 steps, over the bridges.";
  it("gives the distance, not the way again", () => {
    expect(farAnswer("is it far?", way)).toBe("Yes, quite a walk, about 53 steps.");
    expect(farAnswer("how close is it", "Just east, about 9 steps.")).toBe("No, it is close, about 9 steps.");
  });
  it("leaves a question about the way alone", () => {
    expect(farAnswer("where is the pond?", way)).toBe(way);
  });
});
