import React, { useState, createContext, useEffect } from 'react';
import Pact from "pact-lang-api";
import AES from 'crypto-js/aes'
import CryptoJS from 'crypto-js'

const keepDecimal = decimal => {
  decimal = parseFloat(decimal).toPrecision(13)
  const num = decimal.toString().indexOf('.') === -1 ? `${decimal}.0` : decimal
  return num
}


export const PactContext = createContext();

const savedAcct = localStorage.getItem('acct');
const savedPrivKey = localStorage.getItem('pk');
const savedNetwork = localStorage.getItem('network');
const savedSlippage = localStorage.getItem('slippage');
const savedSigning = localStorage.getItem('signing');

const network = "https://us1.testnet.chainweb.com/chainweb/0.0/testnet04/chain/0/pact";
const chainId = "0";
const creationTime = () => Math.round((new Date).getTime()/1000)-10;

export const PactProvider = (props) => {


  //
  // const test = async () => {
  //   const k = await CryptoJS.RC4Drop.encrypt('hi', 'there');
  //   console.log(k)
  //   //NOT WORKING
  //   JSON.stringify(k)
  //   const s = await CryptoJS.RC4Drop.decrypt(k, 'there')
  //
  //   console.log(s)
  //   console.log(typeof s.toString(CryptoJS.enc.Utf8))
  //   console.log(typeof s)
  //   if (s.sigBytes >= 0) {
  //     console.log('w')
  //   } else {
  //     console.log('didnt')
  //   }
  // }
  // test()

  const [account, setAccount] = useState((savedAcct ? JSON.parse(savedAcct) : {account: null, guard: null, balance: 0}));
  const [tokenAccount, setTokenAccount] = useState({account: null, guard: null, balance: 0});
  const [privKey, setPrivKey] = useState((savedPrivKey ? savedPrivKey : ""));
  const keyPair = privKey ? Pact.crypto.restoreKeyPairFromSecretKey(privKey) : "";
  const [tokenFromAccount, setTokenFromAccount] = useState({account: null, guard: null, balance: 0});
  const [tokenToAccount, setTokenToAccount] = useState({account: null, guard: null, balance: 0});
  const [tokenList, setTokenList] = useState({tokens: []});
  const [pairAccount, setPairAccount] = useState("");
  const [pairReserve, setPairReserve] = useState("");
  const [pair, setPair] = useState("");
  const [ratio, setRatio] = useState(NaN);
  const [pairAccountBalance, setPairAccountBalance] = useState(null);
  const [supplied, setSupplied] = useState(false);
  const [slippage, setSlippage] = useState((savedSlippage ? savedSlippage : 0.50));
  const [liquidityProviderFee, setLiquidityProviderFee] = useState(0.003);
  const [cmd, setCmd] = useState(null);
  const [localRes, setLocalRes] = useState(null);
  const [polling, setPolling] = useState(false);
  const [totalSupply, setTotalSupply] = useState("")
  const [pairList, setPairList] = useState("")
  const [poolBalance, setPoolBalance] = useState(["N/A", "N/A"]);
  const [sendRes, setSendRes] = useState(null);
  const [signing, setSigning] = useState(savedSigning ? JSON.parse(savedSigning) : { method: 'none', key: "" })

  useEffect(() => {
    pairReserve ? setRatio(pairReserve['token0']/pairReserve['token1']) : setRatio(NaN)
  }, [pairReserve]);

  useEffect(() => {
    if (account.account) setVerifiedAccount(account.account)
  }, [])

  useEffect(() => {
    const store = async () => localStorage.setItem('signing', JSON.stringify(signing));
    store()
  }, [signing])


  const getCorrectBalance = (balance) => {
    const balanceClean = (!isNaN(balance) ? balance : balance.decimal)
    return balanceClean
  }

  const storeSlippage = async (slippage) => {
    await setSlippage(slippage)
    await localStorage.setItem('slippage', slippage);
  }

  const setVerifiedAccount = async (accountName) => {
    try {
      let data = await Pact.fetch.local({
          pactCode: `(coin.details ${JSON.stringify(accountName)})`,
          meta: Pact.lang.mkMeta("", chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        console.log(data)
        if (data.result.status === "success"){
          await localStorage.setItem('acct', JSON.stringify(data.result.data));
          setAccount({...data.result.data, balance: getCorrectBalance(data.result.data.balance)});
          await localStorage.setItem('acct', JSON.stringify(data.result.data));
          console.log("Account is set to ", accountName);
        } else {
          setAccount({account: null, guard: null, balance: 0});
          console.log("Account is not verified")
        }
    } catch (e) {
      console.log(e)
    }
  }

  const getTokenAccount = async (token, account, first) => {
    console.log("gettokenaccount", token, `(${token}.details ${JSON.stringify(account)})`)
    try {
      let data = await Pact.fetch.local({
          pactCode: `(${token}.details ${JSON.stringify(account)})`,
          keyPairs: Pact.crypto.genKeyPair(),
          meta: Pact.lang.mkMeta("", chainId ,0.01,100000000, 28800, creationTime()),
        }, network);
        console.log(data, "gettoken")
        if (data.result.status === "success"){
          // setTokenAccount({...data.result.data, balance: getCorrectBalance(data.result.data.balance)});
          console.log(tokenFromAccount, token, first)
          first ? setTokenFromAccount(data.result.data) : setTokenToAccount(data.result.data)
          console.log(data.result.data)
          return data.result.data
        } else if (data.result.status === "failure"){
          first ? setTokenFromAccount({ account: null, guard: null, balance: 0 }) : setTokenToAccount({ account: null, guard: null, balance: 0 })
          return { account: null, guard: null, balance: 0 }
          console.log("Account does not exist")
        }
    } catch (e) {
      console.log(e)
    }
  }

  const getTotalTokenSupply = async (token0, token1) => {
    try {
      let data = await Pact.fetch.local({
          pactCode: `(swap.tokens.total-supply (swap.exchange.get-pair-key ${token0} ${token1}))`,
          keyPairs: Pact.crypto.genKeyPair(),
          meta: Pact.lang.mkMeta("", chainId ,0.01,100000000, 28800, creationTime()),
        }, network);
        if (data.result.status === "success"){
          console.log(data)
          setTotalSupply(data.result.data);
          console.log(data.result.data)
        } else {
          console.log("Account is not verified")
        }
    } catch (e) {
      console.log(e)
    }
  }

  const createTokenPair = async (token0, token1, amountDesired0, amountDesired1) => {
    try {
      let data = await Pact.fetch.send({
          pactCode: `(swap.exchange.create-pair
              ${token0}
              ${token1}
              ""
            )`,
          keyPairs: keyPair,
          meta: Pact.lang.mkMeta(account.account, chainId ,0.0001,3000,creationTime(),28800),
          networkId: "testnet04"
        }, network);
      Pact.fetch.listen({listen: data.requestKeys[0]}, network)
      .then(() => {
        addLiquidity(token0, token1, amountDesired0, amountDesired1);
      })
    } catch (e) {
      console.log(e)
    }
  }

  const addLiquidityLocal = async (token0, token1, amountDesired0, amountDesired1) => {
    try {
      let pair = await getPairAccount(token0, token1);
      let amount0Decimal = keepDecimal(amountDesired0);
      let amount1Decimal = keepDecimal(amountDesired1);
      let data = await Pact.fetch.local({
          pactCode: `(swap.exchange.add-liquidity
              ${token0}
              ${token1}
              ${keepDecimal(amountDesired0)}
              ${keepDecimal(amountDesired1)}
              ${keepDecimal(amountDesired0*(1-0.003))}
              ${keepDecimal(amountDesired1*(1-0.003))}
              ${JSON.stringify(account.account)}
              ${JSON.stringify(account.account)}
              (read-keyset 'user-ks)
              (at 'block-time (chain-data))
            )`,
          keyPairs: {
            ...keyPair,
            clist: [
              {name: `${token0}.TRANSFER`, args: [account.account, pair, Number(amountDesired0)]},
              {name: `${token1}.TRANSFER`, args: [account.account, pair, Number(amountDesired1)]},
              {name: `coin.GAS`, args: []}
            ]
          },
          envData: {
            "user-ks": [keyPair.publicKey]
          },
          meta: Pact.lang.mkMeta(account.account, chainId ,0.0001,3000,creationTime(), 600),
          networkId: "testnet04"
        }, network);
        console.log(data);
        setLocalRes(data);
        console.log(localRes);
    } catch (e) {
      setLocalRes({});
      console.log(e)
    }
  }


  const addLiquidity = async (token0, token1, amountDesired0, amountDesired1) => {
    try {
      let pair = await getPairAccount(token0, token1);
      let data = await Pact.fetch.send({
          pactCode: `(swap.exchange.add-liquidity
              ${token0}
              ${token1}
              ${keepDecimal(amountDesired0)}
              ${keepDecimal(amountDesired1)}
              ${keepDecimal(amountDesired0*(1-0.003))}
              ${keepDecimal(amountDesired1*(1-0.003))}
              ${JSON.stringify(account.account)}
              ${JSON.stringify(account.account)}
              (read-keyset 'user-ks)
              (at 'block-time (chain-data))
            )`,
          keyPairs: {
            ...keyPair,
            clist: [
              {name: `${token0}.TRANSFER`, args: [account.account, pair, Number(keepDecimal(amountDesired0))]},
              {name: `${token1}.TRANSFER`, args: [account.account, pair, Number(keepDecimal(amountDesired1))]},
              {name: `coin.GAS`, args: []}
            ]
          },
          envData: {
            "user-ks": [keyPair.publicKey]
          },
          meta: Pact.lang.mkMeta(account.account, chainId ,0.0001,3000,creationTime(), 600),
          networkId: "testnet04"
        }, network);
        console.log(data);
    } catch (e) {
      console.log(e)
    }
  }

  const removeLiquidity = async (token0, token1, liquidity) => {
    try {
      // let pairKey = await getPairKey(token0, token1);
      let pairKey = "coin:free.abc"
      liquidity = keepDecimal(liquidity);
      let pair = await getPairAccount(token0, token1);
      let data = await Pact.fetch.send({
          pactCode: `(swap.exchange.remove-liquidity
              ${token0}
              ${token1}
              ${liquidity}
              0.0
              0.0
              ${JSON.stringify(account.account)}
              ${JSON.stringify(account.account)}
              (read-keyset 'user-ks)
              (at 'block-time (chain-data))
            )`,
            networkId: "testnet04",
          keyPairs: {
            ...keyPair,
            clist: [
              {name: `swap.tokens.TRANSFER`, args: [pairKey, account.account, pair, Number(liquidity)]},
              {name: `swap.tokens.TRANSFER`, args: [pairKey, account.account, pair, Number(liquidity)]},
              {name: `coin.GAS`, args: []}
            ]
          },
          envData: {
            "user-ks": [keyPair.publicKey]
          },
          meta: Pact.lang.mkMeta(account.account, chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        console.log(data);
    } catch (e) {
      console.log(e)
    }
  }

  const getPairAccount = async (token0, token1) => {
    try {
      let data = await Pact.fetch.local({
          pactCode: `(at 'account (swap.exchange.get-pair ${token0} ${token1}))`,
          meta: Pact.lang.mkMeta("", chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        if (data.result.status === "success"){
          setPairAccount(data.result.data);
          return data.result.data;
          console.log("Pair Account is set to", data.result.data);
        } else {
          console.log("Pair Account is not verified")
        }
        console.log(data);
    } catch (e) {
      console.log(e)
    }
  }

  const getPair = async (token0, token1) => {
    try {
      let data = await Pact.fetch.local({
          pactCode: `(swap.exchange.get-pair ${token0} ${token1})`,
          keyPairs: Pact.crypto.genKeyPair(),
          meta: Pact.lang.mkMeta(account.account, chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        if (data.result.status === "success"){
          setPair(data.result.data);
          console.log("Pair is set to", data.result.data);
          return data.result.data;
        } else {
          return null;
          console.log("Pair does not exist")
        }
        console.log(data);
    } catch (e) {
      console.log('fail')
      console.log(e)
    }
  }


  const getPairKey = async (token0, token1) => {
    try {
      let data = await Pact.fetch.local({
          pactCode: `(swap.exchange.get-pair-key ${token0} ${token1})`,
          meta: Pact.lang.mkMeta(account.account, chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        if (data.result.status === "success"){
          // setPairKey(data.result.data);
          return data.result.data;
          console.log("Pair Account is set to", data.result.data);
        } else {
          console.log("Pair Account is not verified")
        }
        console.log(data);
    } catch (e) {
      console.log(e)
    }
  }

  const getPairAccountBalance = async (token0, token1, account) => {
    try {
      let data = await Pact.fetch.local({
          pactCode: `(swap.tokens.get-balance (swap.exchange.get-pair-key ${token0} ${token1}) ${JSON.stringify(account)})`,
          meta: Pact.lang.mkMeta("", chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        if (data.result.status === "success"){
          console.log("Success", data.result.data);
          setPairAccountBalance(data.result.data);
        } else {
          console.log("Fail", data)
          // setPairAccountBalance(null);
          console.log("Pair Account is not verified")
        }
    } catch (e) {
      console.log(e)
    }
  }

  const getReserves = async (token0, token1) => {
    try {
      let data = await Pact.fetch.local({
          pactCode: `
          (use swap.exchange)
          (let*
            (
              (p (get-pair ${token0} ${token1}))
              (reserveA (reserve-for p ${token0}))
              (reserveB (reserve-for p ${token1}))
            )[reserveA reserveB])
           `,
           meta: Pact.lang.mkMeta("account", chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        if (data.result.status === "success"){
          console.log("succeeded, update reserve", data.result.data)
          await setPairReserve({token0: data.result.data[0].decimal? data.result.data[0].decimal:  data.result.data[0], token1: data.result.data[1].decimal? data.result.data[1].decimal:  data.result.data[1]});
        } else {
          console.log("Failed")
        }
    } catch (e) {
      console.log(e)
    }
  }

  const getPooledAmount = async (token0, token1, account) => {
    let pairKey = "coin:free.abc"
    let pair = await getPairAccount(token0, token1);
    try {
      let data = await Pact.fetch.local({
          pactCode: `
          (use swap.exchange)
          (let*
            (
              (p (get-pair ${token0} ${token1}))
              (reserveA (reserve-for p ${token0}))
              (reserveB (reserve-for p ${token1}))
              (totalBal (swap.tokens.total-supply (swap.exchange.get-pair-key ${token0} ${token1})))
              (acctBal (swap.tokens.get-balance (swap.exchange.get-pair-key ${token0} ${token1}) ${JSON.stringify(account)}))
            )[(* reserveA (/ acctBal totalBal))(* reserveB (/ acctBal totalBal))])
           `,
           meta: Pact.lang.mkMeta("", chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        console.log(data)
        let balance0= data.result.data[0].decimal?data.result.data[0].decimal :data.result.data[0] ;
        let balance1= data.result.data[1].decimal?data.result.data[1].decimal :data.result.data[1] ;
        setPoolBalance([balance0, balance1]);
        if (data.result.status === "success"){
          console.log(data, " pooledamount")
        } else {
          console.log("Failed")
        }
    } catch (e) {
      console.log(e)
    }
  }

  const tokens = async (token0, token1, account) => {
    try {
      let data = await Pact.fetch.local({
          pactCode: `
          (swap.tokens.get-tokens)
           `,
           meta: Pact.lang.mkMeta("", chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        if (data.result.status === "success"){
          return data.result.data;
        } else {
          await setPairReserve(null)
          console.log("Failed")
        }
    } catch (e) {
      console.log(e)
    }
  }


  const swap = async (token0, token1, isSwapIn) => {
    try {
      let pair = await getPairAccount(token0.address, token1.address);

      const inPactCode = `(swap.exchange.swap-exact-in
          ${keepDecimal(token0.amount)}
          ${keepDecimal(token1.amount*(1-slippage))}
          [${token0.address} ${token1.address}]
          ${JSON.stringify(account.account)}
          ${JSON.stringify(account.account)}
          (read-keyset 'user-ks)
          (at 'block-time (chain-data))
        )`
      const outPactCode = `(swap.exchange.swap-exact-out
          ${keepDecimal(token1.amount)}
          ${keepDecimal(token0.amount*(1+slippage))}
          [${token0.address} ${token1.address}]
          ${JSON.stringify(account.account)}
          ${JSON.stringify(account.account)}
          (read-keyset 'user-ks)
          (at 'block-time (chain-data))
        )`
      const cmd = {
          pactCode: (isSwapIn ? inPactCode : outPactCode),
          keyPairs: {
            publicKey: account.guard.keys[0],
            secretKey: privKey,
            clist: [
              {name: `${token0.address}.TRANSFER`, args: [account.account, pair, Number(token0.amount*(1+slippage))]},
            ]
          },
          envData: {
            "user-ks": account.guard
          },
          meta: Pact.lang.mkMeta("", "" ,0,0,0,0),
          networkId: "testnet04",
          meta: Pact.lang.mkMeta(account.account, chainId ,0.0001,3000,creationTime(), 600),
      }
      setCmd(cmd);
      console.log(cmd)
      let data = await Pact.fetch.send(cmd, network);
      console.log(data);
    } catch (e) {
      console.log(e)
    }
  }

  const swapLocal = async (token0, token1, isSwapIn) => {
    try {
      let privKey = signing.key
      if (signing.method === 'pk+pw') {
        const pw = prompt("please enter your password")
        privKey = await decryptKey(pw)
      }
      console.log(privKey)
      if (privKey.length !== 64) {
        return
      }
      const ct = creationTime();
      console.log(account.account)
      let pair = await getPairAccount(token0.address, token1.address);
      const inPactCode = `(swap.exchange.swap-exact-in
          ${keepDecimal(token0.amount)}
          ${keepDecimal(token1.amount*(1-slippage))}
          [${token0.address} ${token1.address}]
          ${JSON.stringify(account.account)}
          ${JSON.stringify(account.account)}
          (read-keyset 'user-ks)
          (at 'block-time (chain-data))
        )`
      const outPactCode = `(swap.exchange.swap-exact-out
          ${keepDecimal(token1.amount)}
          ${keepDecimal(token0.amount*(1+slippage))}
          [${token0.address} ${token1.address}]
          ${JSON.stringify(account.account)}
          ${JSON.stringify(account.account)}
          (read-keyset 'user-ks)
          (at 'block-time (chain-data))
        )`
      const cmd = {
          pactCode: (isSwapIn ? inPactCode : outPactCode),
          keyPairs: {
            publicKey: account.guard.keys[0],
            secretKey: privKey,
            clist: [
              {name: "coin.GAS", args: []},
              {name: `${token0.address}.TRANSFER`, args: [account.account, pair, parseFloat(keepDecimal(token0.amount*(1+slippage)))]},
            ]
          },
          envData: {
            "user-ks": account.guard
          },
          networkId: "testnet04",
          meta: Pact.lang.mkMeta(account.account, chainId, 0.0001, 3000, ct, 600),
      }
      setCmd(cmd);
      console.log(cmd)
      let data = await Pact.fetch.local(cmd, network);
      setLocalRes(data);
      console.log(data);
      return data;
    } catch (e) {
      setLocalRes({});
      return -1
      console.log(e)
    }
  }

  const swapSend = async () => {
    setPolling(true)
    try {
      console.log(cmd)
      const data = await Pact.fetch.send(cmd, network)
      console.log(data)
      await listen(data.requestKeys[0]);
      setPolling(false)
    } catch (e) {
      setPolling(false)
      console.log(e)
    }
  }

  const listen = async (reqKey) => {
    const res = await Pact.fetch.listen({listen: reqKey}, network);
    console.log(res);
    setSendRes(res);
  }

  const getAccountTokenList = async (account) => {
    let list = await tokens();
    list =
    list
    .map(pair =>  {
      return `(swap.tokens.get-balance ${JSON.stringify(pair)} ${JSON.stringify(account)})`;
    })

    try {
      let data = await Pact.fetch.local({
          pactCode: list[0],
          meta: Pact.lang.mkMeta("account", chainId ,0.0001,3000,creationTime(), 600),
        }, network);
        if (data.result.status === "success"){

          console.log("Success", data.result.data);
        } else {
          console.log("Fail", data)
          // setPairAccountBalance(null);
          console.log("Pair Account is not verified")
        }
    } catch (e) {
      console.log(e)
    }
  }

  const getRatio = (toToken, fromToken) => {
    if (toToken===fromToken) return 1;
    return pairReserve["token1"]/pairReserve["token0"]
  }

  const getRatio1 = (toToken, fromToken) => {
    if (toToken===fromToken) return 1;
    return pairReserve["token0"]/pairReserve["token1"]
  }

  const share = (amount) => {
    return Number(amount)/(Number(pairReserve["token0"])+Number(amount));
  }

  const clearSendRes = () => {
    setVerifiedAccount(account.account)
    setSendRes(null);
  }

  const storePrivKey = async (pk) => {
    setSigning({ method: 'pk', key: pk });
    await setPrivKey(pk)
    await localStorage.setItem('pk', pk);
  }

  const setSigningMethod = async (meth) => {
    await setSigning({ ...signing, method: meth })
  }

  const signingWallet = () => {
    setSigning({ method: 'sign', key: "" })
  }

  const decryptKey = async (pw) => {
    const singing = await localStorage.getItem('signing');
    const encrypted = signing.key
    const decryptedObj = CryptoJS.RC4Drop.decrypt(encrypted, pw)
    if (decryptedObj.sigBytes < 0) return null
    return decryptedObj.toString(CryptoJS.enc.Utf8)
  }

  const encryptKey = async (pk, pw) => {
    console.log(pk, pw)
    const encrypted = CryptoJS.RC4Drop.encrypt(pk, pw);
    setSigning({ method: 'pk+pw', key: encrypted })
  }



  return (
    <PactContext.Provider
      value={{
        tokens,
        getAccountTokenList,
        pairList,
        account,
        setVerifiedAccount,
        getTokenAccount,
        getRatio,
        getRatio1,
        supplied,
        setSupplied,
        addLiquidity,
        addLiquidityLocal,
        removeLiquidity,
        createTokenPair,
        pairAccount,
        pairAccountBalance,
        getPairAccount,
        getPairAccountBalance,
        privKey,
        storePrivKey,
        tokenAccount,
        tokenFromAccount,
        tokenToAccount,
        getPair,
        getReserves,
        pairReserve,
        ratio,
        swap,
        swapLocal,
        swapSend,
        slippage,
        storeSlippage,
        getCorrectBalance,
        liquidityProviderFee,
        localRes,
        polling,
        getPooledAmount,
        getTotalTokenSupply,
        totalSupply,
        share,
        poolBalance,
        pair,
        sendRes,
        clearSendRes,
        signing,
        setSigningMethod,
        encryptKey,
        signingWallet
      }}
    >
      {props.children}
    </PactContext.Provider>
  );
};

export const PactConsumer = PactContext.Consumer;

export const withPactContext = (Component) => (props) => (
  <PactConsumer>{(providerProps) => <Component {...props} sessionContextProps={providerProps} />}</PactConsumer>
);