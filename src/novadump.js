const nova = require("./nova")
const thrift = require("./thrift")
const pcap = require("pcap")
const pcapSession = pcap.createSession("", "tcp")
const tcpTracker = new pcap.TCPTracker()
const BigNumber = require("bignumber.js")
const MuduoBuffer = require("./muduoBuffer")


/// {{{ 修复官方tcpTracker一个丢包的bug
const TCPSession = pcap.TCPSession
const IPv4 = require("pcap/decode/ipv4")
const TCP = require("pcap/decode/tcp")

tcpTracker.track_packet = function (packet) {
  var ip, tcp, src, dst, key, session;

  if (packet.payload.payload instanceof IPv4 && packet.payload.payload.payload instanceof TCP) {
    ip = packet.payload.payload;
    tcp = ip.payload;
    src = ip.saddr + ":" + tcp.sport;
    dst = ip.daddr + ":" + tcp.dport;

    if (src < dst) {
      key = src + "-" + dst;
    } else {
      key = dst + "-" + src;
    }

    var is_new = false;
    session = this.sessions[key];
    if (!session) {
      is_new = true;
      session = new TCPSession();
      this.sessions[key] = session;
    }

    session.track(packet);

    if (is_new) {
      this.emit("session", session);

      // is_new && ESTAB 不一定是 三次握手, 可能packet携带数据
      if (session.state === "ESTAB") {
        session.ESTAB(packet);
      }
    }
  }
}.bind(tcpTracker)
/// }}}




pcapSession.on("packet", function (raw_packet) {
  const packet = pcap.decode.packet(raw_packet)
  tcpTracker.track_packet(packet)
})


tcpTracker.on("session", function (session) {
  // console.log("Start of TCP session between " + session.src_name + " and " + session.dst_name)

  let isNovaSession = void 0
  let sendBuf = new MuduoBuffer()
  let recvBuf = new MuduoBuffer()


  session.on("data send", (function () {
    let detected
    return function (session, data) {
      if (detected === false) {
        return
      }
      sendBuf.append(data)

      // console.log(session.src_name + " -> " + session.dst_name + " data send " + session.send_bytes_payload + " + " + data.length + " bytes")
      if (detected === void 0) {
        detected = nova.detect(sendBuf)
      }

      if (detected === void 0) {
        return
      } else if (detected === false) {
        sendBuf = void 0
        return
      } else if (detected === true) {
        isNovaSession = true
        const msgSize = sendBuf.peekInt32()
        if (sendBuf.readableBytes() >= msgSize) {
          const novaBuf = sendBuf.read(msgSize)
          const { ip, port, service, method, seq, attach, thriftBuffer } = nova.decode(novaBuf)
          const thriftObj = thrift.decode(thriftBuffer)
          if (thriftObj === null) {
            return
          }
          const { type, name, id, fields } = thriftObj

          console.log(`\x1b[1m${session.src}\x1b[0m > \x1b[1m${session.dst}\x1b[0m nova_ip \x1b[1m${ip}\x1b[0m nova_port \x1b[1m${port}\x1b[0m nova_seq \x1b[1m${seq}\x1b[0m`)
          console.log(`\x1b[1;33m${type}\x1b[0m \x1b[1;32m${service}.${method}\x1b[0m`)
          if (Object.getOwnPropertyNames(attach).length !== 0) {
            console.log(`\x1b[2m${JSON.stringify(attach)}\x1b[0m`)
          }
          console.log(JSON.stringify(fields))
          console.log()
        }
      }
    }
  }()))


  session.on("data recv", (function () {
    let detected
    return function (session, data) {
      if (detected === false) {
        return
      }
      recvBuf.append(data)

      // console.log(session.dst_name + " -> " + session.src_name + " data recv " + session.recv_bytes_payload + " + " + data.length + " bytes")    
      if (detected === void 0) {
        detected = nova.detect(recvBuf)
      }

      if (detected === void 0) {
        return
      } else if (detected === false) {
        recvBuf = void 0
        return
      } else if (detected === true) {
        isNovaSession = true
        const msgSize = recvBuf.peekInt32()
        if (recvBuf.readableBytes() >= msgSize) {
          const novaBuf = recvBuf.read(msgSize)
          const { ip, port, service, method, seq, attach, thriftBuffer } = nova.decode(novaBuf)
          const thriftObj = thrift.decode(thriftBuffer)
          if (thriftObj === null) {
            return
          }
          const { type, name, id, fields } = thriftObj

          console.log(`\x1b[1m${session.src}\x1b[0m > \x1b[1m${session.dst}\x1b[0m nova_ip \x1b[1m${ip}\x1b[0m nova_port \x1b[1m${port}\x1b[0m nova_seq \x1b[1m${seq}\x1b[0m`)
          console.log(`\x1b[1;33m${type}\x1b[0m \x1b[1;32m${service}.${method}\x1b[0m`)
          if (Object.getOwnPropertyNames(attach).length !== 0) {
            console.log(`\x1b[2m${JSON.stringify(attach)}\x1b[0m`)
          }
          console.log(JSON.stringify(fields))
          console.log()
        }
      }
    }
  }()))

  session.on("end", function (session) {
    if (isNovaSession === true) {
      console.log("End of TCP session between " + session.src_name + " and " + session.dst_name)
      // console.log("Set stats for session: ", session.session_stats())
      sendBuf = void 0
      recvBuf = void 0
    }
  })
})

/*
"syn retry";
"reset";
"start";
"retransmit";
"data send";
"data recv";
"end";
*/
