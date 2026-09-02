import { useEffect, useState } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import gameCardArtifact from "./abi/GameCard.json";

const CONTRACT_ADDRESS =
  "0xeaFBdB1030F7363B89e533e55AD07fD3a9E5B4DF";

const SEPOLIA_CHAIN_ID = 11155111n;

declare global {
  interface Window {
    ethereum?: any;
  }
}

type Card = {
  id: number;
  name: string;
  description: string;
  image: string;
  rarity: string;
  owner: string;
};

type Listing = {
  seller: string;
  price: string;
};

function App() {
  const [account, setAccount] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [listings, setListings] = useState<Record<number, Listing>>({});
  const [loading, setLoading] = useState(false);
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [listingLoading, setListingLoading] = useState<number | null>(null);
  const [buyLoading, setBuyLoading] = useState<number | null>(null);

  const [network, setNetwork] = useState("");
  const [networkError, setNetworkError] = useState("");

  // --------------------------------------------------
  // CHECK NETWORK
  // --------------------------------------------------

  async function checkNetwork(provider: BrowserProvider) {
    const networkInfo = await provider.getNetwork();

    if (networkInfo.chainId === SEPOLIA_CHAIN_ID) {
      setNetwork("Sepolia");
      setNetworkError("");
      return true;
    }

    setNetwork("");
    setNetworkError("Wrong Network — Please switch MetaMask to Sepolia");
    return false;
  }

  // --------------------------------------------------
  // CONNECT WALLET
  // --------------------------------------------------

  async function connectWallet() {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);

      const isSepolia = await checkNetwork(provider);

      if (!isSepolia) {
        alert("Please switch MetaMask to the Sepolia network.");
        return;
      }

      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setAccount(address);

      await loadCards(provider);
    } catch (error) {
      console.error("Wallet connection failed:", error);
    }
  }

  // --------------------------------------------------
  // LOAD CARDS
  // --------------------------------------------------

  async function loadCards(provider: BrowserProvider) {
    try {
      setLoading(true);

      const isSepolia = await checkNetwork(provider);

      if (!isSepolia) {
        setCards([]);
        setListings({});
        return;
      }

      const contract = new Contract(
        CONTRACT_ADDRESS,
        gameCardArtifact.abi,
        provider
      );

      const loadedCards: Card[] = [];
      const loadedListings: Record<number, Listing> = {};

      // Currently checking Tokens #1 to #5
      for (let tokenId = 1; tokenId <= 5; tokenId++) {
        try {
          const uri = await contract.tokenURI(tokenId);
          const owner = await contract.ownerOf(tokenId);

          const metadataUrl = uri.replace(
            "ipfs://",
            "https://gateway.pinata.cloud/ipfs/"
          );

          const response = await fetch(metadataUrl);
          const metadata = await response.json();

          const imageUrl = metadata.image.replace(
            "ipfs://",
            "https://gateway.pinata.cloud/ipfs/"
          );

          const rarity =
            metadata.attributes?.find(
              (attribute: { trait_type: string }) =>
                attribute.trait_type === "Rarity"
            )?.value ?? "Unknown";

          loadedCards.push({
            id: tokenId,
            name: tokenId === 1 ? "Ember Wolf" : metadata.name,
            description: metadata.description,
            image: imageUrl,
            rarity,
            owner,
          });

          // Load marketplace listing
          try {
            const listing = await contract.listings(tokenId);

            if (listing.price && listing.price > 0n) {
              loadedListings[tokenId] = {
                seller: listing.seller,
                price: ethers.formatEther(listing.price),
              };
            }
          } catch (error) {
            console.log(`Listing for card #${tokenId} not found`);
          }
        } catch (error) {
          console.log(
            `Token #${tokenId} could not be loaded`,
            error
          );
        }
      }

      setCards(loadedCards);
      setListings(loadedListings);
    } catch (error) {
      console.error("Could not load cards:", error);
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // LIST CARD FOR SALE
  // --------------------------------------------------

  async function listCard(tokenId: number) {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    const price = prices[tokenId];

    if (!price || Number(price) <= 0) {
      alert("Please enter a price greater than 0 ETH.");
      return;
    }

    try {
      setListingLoading(tokenId);

      const provider = new BrowserProvider(window.ethereum);

      const isSepolia = await checkNetwork(provider);

      if (!isSepolia) {
        alert("Please switch MetaMask to Sepolia.");
        return;
      }

      const signer = await provider.getSigner();

      const contract = new Contract(
        CONTRACT_ADDRESS,
        gameCardArtifact.abi,
        signer
      );

      const transaction = await contract.listCard(
        tokenId,
        ethers.parseEther(price)
      );

      await transaction.wait();

      alert(`Card #${tokenId} listed for ${price} ETH`);

      setPrices((previous) => ({
        ...previous,
        [tokenId]: "",
      }));

      await loadCards(provider);
    } catch (error) {
      console.error("Listing failed:", error);
      alert("Listing failed. Check MetaMask.");
    } finally {
      setListingLoading(null);
    }
  }

  // --------------------------------------------------
  // BUY CARD
  // --------------------------------------------------

  async function buyCard(tokenId: number) {
    if (!window.ethereum) {
      alert("Please install MetaMask");
      return;
    }

    try {
      setBuyLoading(tokenId);

      const provider = new BrowserProvider(window.ethereum);

      const isSepolia = await checkNetwork(provider);

      if (!isSepolia) {
        alert("Please switch MetaMask to Sepolia.");
        return;
      }

      const signer = await provider.getSigner();

      const contract = new Contract(
        CONTRACT_ADDRESS,
        gameCardArtifact.abi,
        signer
      );

      const listing = await contract.listings(tokenId);

      if (!listing.price || listing.price === 0n) {
        alert("This card is no longer listed.");
        await loadCards(provider);
        return;
      }

      const transaction = await contract.buyCard(tokenId, {
        value: listing.price,
      });

      await transaction.wait();

      alert(`You bought Card #${tokenId}!`);

      await loadCards(provider);
    } catch (error) {
      console.error("Purchase failed:", error);
      alert(
        "Purchase failed. Check MetaMask and your SepoliaETH balance."
      );
    } finally {
      setBuyLoading(null);
    }
  }

  // --------------------------------------------------
  // HANDLE ACCOUNT CHANGE
  // --------------------------------------------------

  async function handleAccountsChanged(accounts: string[]) {
    if (!accounts || accounts.length === 0) {
      setAccount("");
      return;
    }

    const newAccount = accounts[0];

    setAccount(newAccount);

    if (window.ethereum) {
      const provider = new BrowserProvider(window.ethereum);
      await loadCards(provider);
    }
  }

  // --------------------------------------------------
  // HANDLE NETWORK CHANGE
  // --------------------------------------------------

  async function handleChainChanged() {
    if (!window.ethereum) return;

    const provider = new BrowserProvider(window.ethereum);

    await checkNetwork(provider);
    await loadCards(provider);
  }

  // --------------------------------------------------
  // INITIAL LOAD + METAMASK LISTENERS
  // --------------------------------------------------

  useEffect(() => {
    if (!window.ethereum) return;

    const provider = new BrowserProvider(window.ethereum);

    async function initialize() {
      try {
        const isSepolia = await checkNetwork(provider);

        if (!isSepolia) {
          return;
        }

        const accounts = await provider.send(
          "eth_accounts",
          []
        );

        if (accounts.length > 0) {
          setAccount(accounts[0]);
        }

        await loadCards(provider);
      } catch (error) {
        console.error("Initialization failed:", error);
      }
    }

    initialize();

    window.ethereum.on(
      "accountsChanged",
      handleAccountsChanged
    );

    window.ethereum.on(
      "chainChanged",
      handleChainChanged
    );

    return () => {
      window.ethereum.removeListener(
        "accountsChanged",
        handleAccountsChanged
      );

      window.ethereum.removeListener(
        "chainChanged",
        handleChainChanged
      );
    };
  }, []);

  // --------------------------------------------------
  // MY CARDS
  // --------------------------------------------------

  const myCards = cards.filter(
    (card) =>
      account &&
      card.owner.toLowerCase() === account.toLowerCase()
  );

  // --------------------------------------------------
  // CARD IMAGE STYLE
  //
  // IMPORTANT:
  // The actual card image stays 390px tall.
  // The surrounding image area is now 430px tall,
  // creating 20px breathing space around the card.
  // --------------------------------------------------

  const cardImageStyle: React.CSSProperties = {
    width: "100%",
    height: "390px",
    objectFit: "contain",
    display: "block",
  };

  // --------------------------------------------------
  // IMAGE PALETTE / UPPER CARD AREA
  // --------------------------------------------------

  const cardImageAreaStyle: React.CSSProperties = {
    height: "430px",
    background: "#e9eef7",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    boxSizing: "border-box",
    overflow: "hidden",
  };

  // --------------------------------------------------
  // CARD CONTAINER
  // --------------------------------------------------

  const cardStyle: React.CSSProperties = {
    width: "330px",
    background: "#ffffff",
    border: "1px solid #d7dce5",
    borderRadius: "18px",
    overflow: "hidden",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    flexShrink: 0,
  };

  // --------------------------------------------------
  // GRID STYLE
  //
  // justifyContent:center ensures:
  // 1 card  -> centered
  // 2 cards -> centered together
  // 3 cards -> centered
  // 4 cards -> centered rows
  // etc.
  // --------------------------------------------------
  const cardGridStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: "28px",
    width: "100%",
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 30px 70px",
        fontFamily:
          "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
        background:
          "linear-gradient(135deg, #0f172a 0%, #172554 50%, #111827 100%)",
        color: "#e5e7eb",
        boxSizing: "border-box",
      }}
    >
      {/* PAGE HEADER */}

      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "48px",
            margin: "10px 0 18px",
            fontWeight: 800,
            letterSpacing: "-1px",
          }}
        >
          Game Card Marketplace
        </h1>

        {/* CONNECT WALLET */}

        <button
          onClick={connectWallet}
          style={{
            padding: "12px 22px",
            fontSize: "15px",
            fontWeight: 700,
            cursor: "pointer",
            borderRadius: "10px",
            border: "none",
            background: "#ffffff",
            color: "#172554",
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
          }}
        >
          {account
            ? `Connected: ${account.slice(
                0,
                6
              )}...${account.slice(-4)}`
            : "Connect Wallet"}
        </button>

        {/* NETWORK STATUS */}

        {network === "Sepolia" && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              marginLeft: "12px",
              padding: "9px 14px",
              borderRadius: "999px",
              background: "rgba(34,197,94,0.12)",
              color: "#86efac",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            ✓ Connected to Sepolia
          </div>
        )}

        {networkError && (
          <div
            style={{
              marginTop: "12px",
              color: "#fca5a5",
              fontWeight: 700,
            }}
          >
            ✗ {networkError}
          </div>
        )}

        {/* --------------------------------------------------
            GAME CARDS / MARKETPLACE
        -------------------------------------------------- */}

        <section
          style={{
            marginTop: "55px",
          }}
        >
          <h2
            style={{
              fontSize: "32px",
              marginBottom: "8px",
            }}
          >
            Game Cards
          </h2>

          <p
            style={{
              color: "#94a3b8",
              marginBottom: "30px",
            }}
          >
            Browse, collect, and trade unique mythical beast cards.
          </p>

          {loading && (
            <p
              style={{
                color: "#cbd5e1",
              }}
            >
              Loading cards...
            </p>
          )}

          {/* MARKETPLACE GRID */}

          <div style={cardGridStyle}>
            {cards.map((card) => {
              const listing = listings[card.id];

              const isOwner =
                account &&
                card.owner.toLowerCase() ===
                  account.toLowerCase();

              return (
                <div
                  key={card.id}
                  style={cardStyle}
                >
                  {/* CARD IMAGE */}

                  <div style={cardImageAreaStyle}>
                    <img
                      src={card.image}
                      alt={card.name}
                      style={cardImageStyle}
                    />
                  </div>

                  {/* CARD INFORMATION */}

                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#172033",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "10px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "21px",
                          fontWeight: 800,
                          textAlign: "left",
                        }}
                      >
                        {card.name}
                      </h3>

                      <span
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          background: "#eef2ff",
                          color: "#3730a3",
                          fontSize: "12px",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {card.rarity}
                      </span>
                    </div>

                    <p
                      style={{
                        color: "#64748b",
                        lineHeight: 1.5,
                        fontSize: "14px",
                        minHeight: "63px",
                        margin: "0 0 12px",
                      }}
                    >
                      {card.description}
                    </p>

                    <p
                      style={{
                        margin: "7px 0",
                        color: "#64748b",
                        fontSize: "14px",
                      }}
                    >
                      Token #{card.id}
                    </p>

                    <p
                      style={{
                        margin: "7px 0 15px",
                        color: "#64748b",
                        fontSize: "14px",
                      }}
                    >
                      Owner:{" "}
                      <strong>
                        {card.owner.slice(0, 6)}...
                        {card.owner.slice(-4)}
                      </strong>
                    </p>

                    {/* LISTING */}

                    {listing ? (
                      <div
                        style={{
                          marginTop: "12px",
                          paddingTop: "12px",
                          borderTop:
                            "1px solid #e5e7eb",
                        }}
                      >
                        <p
                          style={{
                            margin: "0 0 12px",
                            fontWeight: 800,
                            color: "#334155",
                          }}
                        >
                          Listed for{" "}
                          {listing.price} ETH
                        </p>

                        {!isOwner && account && (
                          <button
                            onClick={() =>
                              buyCard(card.id)
                            }
                            disabled={
                              buyLoading === card.id
                            }
                            style={{
                              width: "100%",
                              padding: "11px",
                              cursor:
                                buyLoading ===
                                card.id
                                  ? "not-allowed"
                                  : "pointer",
                              borderRadius: "9px",
                              border: "none",
                              background:
                                "#172554",
                              color: "white",
                              fontWeight: 700,
                            }}
                          >
                            {buyLoading === card.id
                              ? "Buying..."
                              : "Buy Card"}
                          </button>
                        )}

                        {isOwner && (
                          <p
                            style={{
                              margin: 0,
                              padding: "9px",
                              borderRadius: "8px",
                              background: "#ecfdf5",
                              color: "#15803d",
                              fontWeight: 800,
                              fontSize: "14px",
                            }}
                          >
                            Your Card
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* OWNER CAN LIST */}

                        {isOwner && (
                          <div
                            style={{
                              marginTop: "12px",
                            }}
                          >
                            <input
                              type="number"
                              step="0.001"
                              min="0"
                              placeholder="Price in ETH"
                              value={
                                prices[card.id] ||
                                ""
                              }
                              onChange={(event) =>
                                setPrices(
                                  (previous) => ({
                                    ...previous,
                                    [card.id]:
                                      event.target
                                        .value,
                                  })
                                )
                              }
                              style={{
                                width: "100%",
                                boxSizing:
                                  "border-box",
                                padding: "11px 12px",
                                border:
                                  "1px solid #cbd5e1",
                                borderRadius: "9px",
                                marginBottom: "8px",
                                fontSize: "14px",
                                color: "#111827",
                              }}
                            />

                            <button
                              onClick={() =>
                                listCard(card.id)
                              }
                              disabled={
                                listingLoading ===
                                card.id
                              }
                              style={{
                                width: "100%",
                                padding: "11px",
                                cursor:
                                  listingLoading ===
                                  card.id
                                    ? "not-allowed"
                                    : "pointer",
                                borderRadius: "9px",
                                border: "none",
                                background:
                                  "#334155",
                                color: "white",
                                fontWeight: 700,
                              }}
                            >
                              {listingLoading ===
                              card.id
                                ? "Listing..."
                                : "List for Sale"}
                            </button>
                          </div>
                        )}

                        {!isOwner && (
                          <p
                            style={{
                              margin:
                                "18px 0 0",
                              color: "#94a3b8",
                              fontSize: "14px",
                            }}
                          >
                            Not currently listed
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!loading && cards.length === 0 && (
            <p
              style={{
                color: "#94a3b8",
              }}
            >
              No cards found.
            </p>
          )}
        </section>

        {/* --------------------------------------------------
            MY CARDS
        -------------------------------------------------- */}

        <section
          style={{
            marginTop: "70px",
            paddingTop: "50px",
            borderTop:
              "1px solid rgba(148,163,184,0.2)",
          }}
        >
          <h2
            style={{
              fontSize: "34px",
              margin: "0 0 8px",
            }}
          >
            My Cards
          </h2>

          <p
            style={{
              color: "#94a3b8",
              marginBottom: "32px",
              fontSize: "16px",
            }}
          >
            Cards currently owned by your wallet.
          </p>

          {!account && (
            <p
              style={{
                color: "#cbd5e1",
              }}
            >
              Connect your wallet to see your cards.
            </p>
          )}

          {account && myCards.length === 0 && (
            <p
              style={{
                color: "#cbd5e1",
              }}
            >
              You don't own any cards yet.
            </p>
          )}

          {/* MY CARDS GRID */}

          {myCards.length > 0 && (
            <div style={cardGridStyle}>
              {myCards.map((card) => (
                <div
                  key={card.id}
                  style={cardStyle}
                >
                  {/* CARD IMAGE */}

                  <div style={cardImageAreaStyle}>
                    <img
                      src={card.image}
                      alt={card.name}
                      style={cardImageStyle}
                    />
                  </div>

                  {/* MY CARD INFORMATION */}

                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      color: "#172033",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        gap: "10px",
                        marginBottom: "12px",
                      }}
                    >
                      <h3
                        style={{
                          margin: 0,
                          fontSize: "21px",
                          fontWeight: 800,
                          textAlign: "left",
                        }}
                      >
                        {card.name}
                      </h3>

                      <span
                        style={{
                          padding: "7px 11px",
                          borderRadius: "999px",
                          background: "#eef2ff",
                          color: "#3730a3",
                          fontSize: "12px",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {card.rarity}
                      </span>
                    </div>

                    <p
                      style={{
                        margin: "8px 0",
                        color: "#64748b",
                        fontSize: "14px",
                      }}
                    >
                      Token #{card.id}
                    </p>

                    {listings[card.id] ? (
                      <div
                        style={{
                          marginTop: "15px",
                          padding: "11px",
                          borderRadius: "9px",
                          background: "#ecfdf5",
                          color: "#15803d",
                          fontWeight: 800,
                          fontSize: "14px",
                        }}
                      >
                        Listed for{" "}
                        {listings[card.id].price} ETH
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: "15px",
                          padding: "11px",
                          borderRadius: "9px",
                          background: "#f8fafc",
                          color: "#94a3b8",
                          fontSize: "14px",
                        }}
                      >
                        Not currently listed
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;