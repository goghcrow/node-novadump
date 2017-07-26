# node-novadump

## install

centos

```
sudo yum install -y libpcap-devel.x86_64
sudo yum install -y npm
git clone git@gitlab.qima-inc.com:zanphp/node-novadump.git
cd node-novadump
alias ynpm="npm --registry=http://registry.npm.qima-inc.com"
ynpm install pcap
ynpm install bignumber.js
sudo ./novadump
```


mac


```
brew install node
git clone git@gitlab.qima-inc.com:zanphp/node-novadump.git
cd node-novadump

alias ynpm="npm --registry=http://registry.npm.qima-inc.com"
ynpm install pcap
ynpm install bignumber.js

# 或者

# node_pcap 下要通过仓库安装,否则会安装失败
npm install https://github.com/mranney/node_pcap.git
npm install bignumber.js

```

## 

memory leaky

```
$ node -v
v0.10.48
```