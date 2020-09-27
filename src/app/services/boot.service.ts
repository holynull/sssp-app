import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { interval } from 'rxjs';
import Web3 from 'web3';
import { WalletBase } from 'web3-core';
import { IntallWalletDlgComponent } from '../intall-wallet-dlg/intall-wallet-dlg.component';
import { Balance } from '../model/balance';
import { PoolInfo } from '../model/pool-info';
import { Contract } from 'web3-eth-contract';
import { environment } from 'src/environments/environment';
import { BigNumber } from 'bignumber.js';
@Injectable({
    providedIn: 'root'
})
export class BootService {

    web3: Web3;
    wallet: WalletBase;
    accounts: string[] = new Array();
    bianceChain: any;

    isConnected: boolean = false;

    balance: Balance = new Balance();


    poolInfo: PoolInfo = new PoolInfo();

    daiContract: Contract;
    busdContract: Contract;
    usdtContract: Contract;
    poolContract: Contract;

    contracts: Array<Contract> = new Array();
    contractsAddress: Array<string> = new Array();


    constructor(private dialog: MatDialog) {
        let acc = 0;
        let intervalSubject = interval(200).subscribe(
            async num => {
                acc += num;
                // @ts-ignore
                if (!this.web3 && window.BinanceChain) {
                    // @ts-ignore
                    this.bianceChain = window.BinanceChain;
                    this.isConnected = await this.bianceChain.isConnected();
                    // @ts-ignore
                    this.web3 = new Web3(window.BinanceChain);

                    if (this.isConnected) {
                        this.web3.eth.getAccounts().then(accounts => {
                            this.accounts = accounts;
                            this.loadData();
                        });
                    }

                    // @ts-ignore
                    this.daiContract = new this.web3.eth.Contract(environment.coinABI, environment.contracts.DAI.address);
                    // @ts-ignore
                    this.busdContract = new this.web3.eth.Contract(environment.coinABI, environment.contracts.BUSD.address);
                    // @ts-ignore
                    this.usdtContract = new this.web3.eth.Contract(environment.coinABI, environment.contracts.USDT.address);
                    this.contracts.push(this.daiContract);
                    this.contracts.push(this.busdContract);
                    this.contracts.push(this.usdtContract);
                    this.contractsAddress.push(environment.contracts.DAI.address);
                    this.contractsAddress.push(environment.contracts.BUSD.address);
                    this.contractsAddress.push(environment.contracts.USDT.address);
                    // @ts-ignore
                    this.poolContract = new this.web3.eth.Contract(environment.contracts.StableSmartSwapPool.ABI, environment.contracts.StableSmartSwapPool.address);

                    intervalSubject.unsubscribe();
                }
                if (acc >= 3 && !this.web3) { // 3秒提示安装币安钱包
                    dialog.open(IntallWalletDlgComponent);
                    intervalSubject.unsubscribe();
                }
            }
        );
        interval(1000 * 60).subscribe(num => { // 轮训刷新数据
            if (this.web3 && this.accounts) {
                this.loadData();
            }
        });
    }

    public connectWallet() {
        if (this.web3) {
            this.web3.eth.getAccounts().then(accounts => {
                this.accounts = accounts;
                this.loadData();
            });
        }
    }

    public async loadData() {
        if (this.web3) {
            let daiBalanceStr = await this.daiContract.methods.balanceOf(this.accounts[0]).call({ from: this.accounts[0] });
            let daiDecimals = await this.daiContract.methods.decimals().call({ from: this.accounts[0] });

            let busdBalanceStr = await this.busdContract.methods.balanceOf(this.accounts[0]).call({ from: this.accounts[0] });
            let busdDecimals = await this.busdContract.methods.decimals().call({ from: this.accounts[0] });

            let usdtBalanceStr = await this.usdtContract.methods.balanceOf(this.accounts[0]).call({ from: this.accounts[0] });
            let usdtDecimals = await this.usdtContract.methods.decimals().call({ from: this.accounts[0] });

            let lpBalanceStr = await this.poolContract.methods.balanceOf(this.accounts[0]).call({ from: this.accounts[0] });
            let lpDecimals = await this.poolContract.methods.balanceOf(this.accounts[0]).call({ from: this.accounts[0] });

            this.balance.dai = new BigNumber(daiBalanceStr).div(new BigNumber(10).exponentiatedBy(daiDecimals));
            this.balance.busd = new BigNumber(busdBalanceStr).div(new BigNumber(10).exponentiatedBy(busdDecimals));
            this.balance.usdt = new BigNumber(usdtBalanceStr).div(new BigNumber(10).exponentiatedBy(usdtDecimals));
            this.balance.lp = new BigNumber(lpBalanceStr).div(new BigNumber(10).exponentiatedBy(lpDecimals));

            let pDaiBalanceStr = await this.daiContract.methods.balanceOf(environment.contracts.StableSmartSwapPool.address).call({ from: this.accounts[0] });
            let pBusdBalanceStr = await this.busdContract.methods.balanceOf(environment.contracts.StableSmartSwapPool.address).call({ from: this.accounts[0] });
            let pUsdtBalanceStr = await this.usdtContract.methods.balanceOf(environment.contracts.StableSmartSwapPool.address).call({ from: this.accounts[0] });

            this.poolInfo.dai = new BigNumber(pDaiBalanceStr).div(new BigNumber(10).exponentiatedBy(daiDecimals));
            this.poolInfo.busd = new BigNumber(pBusdBalanceStr).div(new BigNumber(10).exponentiatedBy(busdDecimals));
            this.poolInfo.usdt = new BigNumber(pUsdtBalanceStr).div(new BigNumber(10).exponentiatedBy(usdtDecimals));

            let totalSupplyStr = await this.poolContract.methods.totalSupply().call({ from: this.accounts[0] });
            this.poolInfo.fee = new BigNumber(totalSupplyStr).div(new BigNumber(10).exponentiatedBy(lpDecimals));
        }
    }

    public async addLiquidity(daiAmt: string, busdAmt: string, usdtAmt: string): Promise<any> {
        if (this.poolContract && this.daiContract && this.busdContract && this.usdtContract) {
            daiAmt = this.web3.utils.toWei(daiAmt, 'ether');
            busdAmt = this.web3.utils.toWei(busdAmt, 'ether');
            usdtAmt = this.web3.utils.toWei(usdtAmt, 'ether');
            let data = this.poolContract.methods.add_liquidity([daiAmt, busdAmt, usdtAmt], 0).encodeABI();
            try {
                return await this.web3.eth.sendTransaction({ from: this.accounts[0], to: environment.contracts.StableSmartSwapPool.address, data: data });
            } catch (e) {
                console.log(e);
            }
        }
    }

    public async approve(i: number, amt: string): Promise<any> {
        if (this.poolContract && this.daiContract && this.busdContract && this.usdtContract) {
            amt = this.web3.utils.toWei(amt, 'ether');
            let data = this.contracts[i].methods.approve(environment.contracts.StableSmartSwapPool.address, amt).encodeABI();
            try {
                return await this.web3.eth.sendTransaction({ from: this.accounts[0], to: this.contractsAddress[i], data: data });
            } catch (e) {
                console.log(e);
            }
        }
    }

    public async exchange(i: number, j: number, amt: string, minAmt: string): Promise<any> {
        if (this.poolContract && this.daiContract && this.busdContract && this.usdtContract) {
            amt = this.web3.utils.toWei(String(amt), 'ether');
            minAmt = this.web3.utils.toWei(String(minAmt), 'ether');
            let data = this.poolContract.methods.exchange(i, j, amt, minAmt).encodeABI();
            try {
                return await this.web3.eth.sendTransaction({ from: this.accounts[0], to: environment.contracts.StableSmartSwapPool.address, value: 0, data: data });
            } catch (e) {
                console.log(e);
            }
        }
    }

    public async redeemImBalance(daiAmt: string, busdAmt: string, usdtAmt: string): Promise<any> {
        if (this.poolContract && this.daiContract && this.busdContract && this.usdtContract) {
            daiAmt = this.web3.utils.toWei(daiAmt, 'ether');
            busdAmt = this.web3.utils.toWei(busdAmt, 'ether');
            usdtAmt = this.web3.utils.toWei(usdtAmt, 'ether');
            let lp = await this.poolContract.methods.balanceOf(this.accounts[0]);
            let data = this.poolContract.methods.remove_liquidity_imbalance([daiAmt, busdAmt, usdtAmt], lp).encodeABI();
            try {
                return await this.web3.eth.sendTransaction({ from: this.accounts[0], to: environment.contracts.StableSmartSwapPool.address, data: data });
            } catch (e) {
                console.log(e);
            }
        }
    }


}