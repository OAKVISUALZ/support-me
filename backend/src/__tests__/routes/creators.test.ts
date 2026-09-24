jest.mock("../../prisma", () => ({
  __esModule: true,
  default: {
    creator: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import request from "supertest";
import app from "../../app";
import prisma from "../../prisma";
import { generateToken } from "../../middleware/auth";

const mockedPrisma = prisma as unknown as {
  creator: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
};

describe("GET /api/creators", () => {
  it("lists creators, newest first by default", async () => {
    const creators = [{ id: 1, username: "bob", _count: { donations: 0 } }];
    mockedPrisma.creator.findMany.mockResolvedValue(creators);
    mockedPrisma.creator.count.mockResolvedValue(1);

    const res = await request(app).get("/api/creators");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: creators,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(mockedPrisma.creator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" }, where: undefined })
    );
  });

  it("searches by username/displayName and sorts by donation count", async () => {
    mockedPrisma.creator.findMany.mockResolvedValue([]);
    mockedPrisma.creator.count.mockResolvedValue(0);

    const res = await request(app).get("/api/creators?q=jane&sort=most-supported");

    expect(res.status).toBe(200);
    expect(mockedPrisma.creator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { donations: { _count: "desc" } },
        where: {
          OR: [
            { username: { contains: "jane", mode: "insensitive" } },
            { displayName: { contains: "jane", mode: "insensitive" } },
          ],
        },
      })
    );
  });
});

describe("GET /api/creators/me", () => {
  const token = generateToken(1, "GUSERADDRESS");

  it("rejects requests without an auth token", async () => {
    const res = await request(app).get("/api/creators/me");
    expect(res.status).toBe(401);
  });

  it("returns 404 when the authenticated user has no creator profile", async () => {
    mockedPrisma.creator.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/creators/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("returns only the authenticated user's own creator profile", async () => {
    const creator = { id: 5, userId: 1, username: "bob" };
    mockedPrisma.creator.findUnique.mockResolvedValue(creator);

    const res = await request(app).get("/api/creators/me").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(creator);
    expect(mockedPrisma.creator.findUnique).toHaveBeenCalledWith({ where: { userId: 1 } });
  });
});

describe("GET /api/creators/:username", () => {
  it("returns the creator when found", async () => {
    const creator = { id: 1, username: "bob", donations: [] };
    mockedPrisma.creator.findUnique.mockResolvedValue(creator);

    const res = await request(app).get("/api/creators/bob");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(creator);
  });

  it("returns 404 when the creator does not exist", async () => {
    mockedPrisma.creator.findUnique.mockResolvedValue(null);

    const res = await request(app).get("/api/creators/missing");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });
});

describe("POST /api/creators/:username/create", () => {
  const token = generateToken(1, "GUSERADDRESS");

  it("rejects requests without an auth token", async () => {
    const res = await request(app).post("/api/creators/bob/create").send({});
    expect(res.status).toBe(401);
  });

  it("rejects an invalid username shape before hitting the database", async () => {
    const res = await request(app)
      .post("/api/creators/a/create")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 when the username is already taken", async () => {
    mockedPrisma.creator.findUnique.mockResolvedValueOnce({ id: 2, username: "bob" });

    const res = await request(app)
      .post("/api/creators/bob/create")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("returns 409 when the authenticated user already has a profile", async () => {
    mockedPrisma.creator.findUnique
      .mockResolvedValueOnce(null) // username lookup
      .mockResolvedValueOnce({ id: 3, username: "existing-profile" }); // userId lookup

    const res = await request(app)
      .post("/api/creators/bob/create")
      .set("Authorization", `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("creates a creator profile for a new, authenticated user", async () => {
    mockedPrisma.creator.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const created = {
      id: 4,
      userId: 1,
      username: "bob",
      walletAddress:
        "GA7D5LDGFABXNYEO6LZVMTWK5JWEPTODCLYZ7TG4XDZRKKXP6OS5K5JW",
    };
    mockedPrisma.creator.create.mockResolvedValue(created);

    const res = await request(app)
      .post("/api/creators/bob/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        walletAddress:
          "GA7D5LDGFABXNYEO6LZVMTWK5JWEPTODCLYZ7TG4XDZRKKXP6OS5K5JW",
        displayName: "Bob",
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual(created);
  });
});

describe("PUT /api/creators/:username", () => {
  const token = generateToken(1, "GUSERADDRESS");

  it("rejects requests without an auth token", async () => {
    const res = await request(app).put("/api/creators/bob").send({ bio: "hi" });
    expect(res.status).toBe(401);
  });

  it("returns 404 when updating a creator that does not exist", async () => {
    mockedPrisma.creator.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/creators/missing")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "hi" });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("rejects editing a profile the authenticated user does not own", async () => {
    // Token is for userId 1; this profile belongs to userId 2.
    mockedPrisma.creator.findUnique.mockResolvedValue({ id: 9, userId: 2, username: "bob" });

    const res = await request(app)
      .put("/api/creators/bob")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "hijack" });

    expect(res.status).toBe(401);
    expect(mockedPrisma.creator.update).not.toHaveBeenCalled();
  });

  it("updates a creator the authenticated user owns", async () => {
    mockedPrisma.creator.findUnique.mockResolvedValue({ id: 1, userId: 1, username: "bob" });
    const updated = { id: 1, userId: 1, username: "bob", bio: "hi there" };
    mockedPrisma.creator.update.mockResolvedValue(updated);

    const res = await request(app)
      .put("/api/creators/bob")
      .set("Authorization", `Bearer ${token}`)
      .send({ bio: "hi there" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(mockedPrisma.creator.update).toHaveBeenCalledWith({
      where: { username: "bob" },
      data: { bio: "hi there" },
    });
  });
});
