import React, { useState, useEffect, useContext } from "react";
import Web3Modal from "web3modal";
import { ethers } from "ethers";
import { useRouter} from "next/router";
import axios from "axios";
import { create as ipfsHttpClient } from "ipfs-http-client";

// const client = ipfsHttpClient("https://ipfs.infura.io:5001/api/v0");

const projectId = "2H1mZt8hnCIoXvE1LQ00kjktwKi"
const projectSecretKey = "31054a6a715bc67541d1fa775400db85"
const auth = `Basic ${Buffer.from(`${projectId}:${projectSecretKey}`).toString("base64")}`;

const subdomain = "https://subrata-nft-marketplace.infura-ipfs.io"

const client = ipfsHttpClient({
    host: "infura-ipfs.io",
    port: 5001,
    protocol: "https",
    headers: {
        authorization: auth,
    }
})

//INTERNAL IMPORT
import { NFTMarketplaceAddress, NFTMarketplaceABI } from "./constants";
import { type } from "os";

//FETCH SMART CONTRACT
const fetchContract = (signerOrProvider) =>
    new ethers.Contract(
        NFTMarketplaceAddress,
        NFTMarketplaceABI,
        signerOrProvider
    );

//---CONNECTING WITH SMART CONTRACT

const connectingWithSmartContract = async () => {
    try {
        const web3Modal = new Web3Modal();
        const connection = await web3Modal.connect();
        const provider = new ethers.providers.Web3Provider(connection);
        const signer = provider.getSigner();
        const contract = fetchContract(signer);
        return contract;
    } catch (error) {
        console.log("Something went wrong while connecting smart contract");
    }
};

export const NFTMarketplaceContext = React.createContext();

export const NFTMarketplaceProvider = ({ children }) => {
    const titleData = "Discover, collect and sell NFTs";

    //------USESTATE----//

    const [currentAccount, setCurrentAccount] = useState("");
    const router = useRouter();

    //----CHECK IF WALLET IS CONNECTED

    const checkIfWalletConnected = async () => {
        try {
            if (!window.ethereum) return console.log("Install Metamask");
             

            const accounts = await window.ethereum.request({
                method: "eth_accounts",
            });

            if (accounts.length) {
                setCurrentAccount(accounts[0]);
            } else {
                console.log("No account found");
                
            }
        } catch (error) {
            console.log("Something wrong while connecting to wallet");
        
        }
    };

    useState(() => {
        checkIfWalletConnected();
    }, []);

    //-------CONNECT WALLET FUNCTION------//

    const connectWallet = async () => {
        try {
            if (!window.ethereum) return console.log("Install MetaMask");

            const accounts = await window.ethereum.request({
                method: "eth_requestAccounts",
            });

            setCurrentAccount(accounts[0]);
        } catch (error) {
            console.log("Error while connecting to wallet");
            
        }
    };

    //--------UPLOAD TO IPFS FUNCTION-------//

    const uploadToIPFS = async (file) => {
        try {
            const added = await client.add({ content: file });
            const url = `${subdomain}/ipfs/${added.path}`;
            return url;
        } catch (error) {
            console.log("Error Uploading to IPFS");
            
        }
    };

    //--------CREATENFT FUNCTION--------//

    const createNFT = async (name, price, image, description, router) => {


        if (!name || !description || !price || !image)
            return console.log("data is missing");

        const data = JSON.stringify({ name, description, image});

        try {
            const added = await client.add(data);

            const url = `https://infura-ipfs.io/ipfs/${added.path}`;
            

            await createSale(url, price);
            router.push("/searchPage");
        } catch (error) {
            console.log("Error while creating NFT");
            
        }
    };

    //-----createSale FUNCTION--------//

    const createSale = async (url, formInputPrice, isReselling, id) => {
        try {
            const price = ethers.utils.parseUnits(formInputPrice, "ether");
            const contract = await connectingWithSmartContract();

            const listingPrice = await contract.getListingPrice();

            const transaction = !isReselling
                ? await contract.createToken(url, price, {
                    value: listingPrice.toString(),
                })
                : await contract.resellToken(id, price, {
                    value: listingPrice.toString(),
                });

            await transaction.wait();

            
        } catch (error) {
            
            console.log("error while creating sale");
        }
    };

    //------FETCHNFTS FUNCTION-------//

    const fetchNFTs = async () => {
        try {
            const provider = new ethers.providers.JsonRpcProvider();
            const contract = fetchContract(provider);

            const data = await contract.fetchMarketItems();

            //console.log(data)

            const items = await Promise.all(
                data.map(
                    async ({ tokenId, seller, owner, price: unformattedPrice }) => {
                        const tokenURI = await contract.tokenURI(tokenId);

                        const {
                            data: { image, name, description },
                        } = await axios.get(tokenURI);
                        const price = ethers.utils.formatUnits(
                            unformattedPrice.toString(),
                            "ether"
                        );

                        return {
                            price,
                            tokenId: tokenId.toNumber(),
                            seller,
                            owner,
                            image,
                            name,
                            description,
                            tokenURI,
                        };
                    }
                )
            );

            return items;
        } catch (error) {
            
            console.log("error while fetching NFTs");
        }
    };

    useEffect(() => {
        fetchNFTs();
    }, [])

    //-----FETCHING MY NFT OR LSTED NFTs--------//

    const fetchMyNFTsOrListedNFTs = async (type) => {
        try {
            const contract = await connectingWithSmartContract();

            const data =
                type == "fetchItemsListed"
                    ? await contract.fetchItemsListed()
                    : await contract.fetchMyNFTs();

            const items = await Promise.all(
                data.map(
                    async ({ tokenId, seller, owner, price: unformattedPrice }) => {
                        const tokenURI = await contract.tokenURI(tokenId);
                        const {
                            data: { image, name, description },
                        } = await axios.get(tokenURI);
                        const price = ethers.utils.formatUnits(
                            unformattedPrice.toString(),
                            "ether"
                        );

                        return {
                            price,
                            tokenId: tokenId.toNumber(),
                            seller,
                            owner,
                            image,
                            name,
                            description,
                            tokenURI,
                        };
                    }
                )
            );
            return items;
        } catch (error) {
            console.log("error while fetching listed NFTs")
        }
    };

    useEffect(() => {
      fetchMyNFTsOrListedNFTs()
    }, [])
    

    //----BUY NFTs FUNCTION----//

    const buyNFT = async(nft) => {
        try {
            const contract = await connectingWithSmartContract();
            const price = ethers.utils.parseUnits(nft.price.toString(), "ether");

            const transaction = await contract.createMarketSale(nft.tokenId, {
                value: price,
            })

            await transaction.wait();
            router.push("/author")
        } catch (error) {
            console.log("Error While buying NFT");
        }
    }
    
    return (
        <NFTMarketplaceContext.Provider
            value={{
                checkIfWalletConnected,
                connectWallet,
                uploadToIPFS,
                createNFT,
                fetchNFTs,
                fetchMyNFTsOrListedNFTs,
                buyNFT,
                createSale,
                currentAccount,
                titleData,
            }}
        >
            {children}
        </NFTMarketplaceContext.Provider>
    );
};
