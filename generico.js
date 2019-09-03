/*
TRAMA ETHERNET
{
    origen: AB.CD.ED.F0.12.34,
    destino: 01.23.45.67.89.AB,
    ethertype: '0806',
    payload: {},
    datlng:234 //tamaño total de la trama
}

PAQUETE ARP REQUEST
{
    htype: 1,
    ptype: '0800',
    operation: 'Request',
    sha: ethernet local,
    spa: ip local,
    tha: '', //ethernet remoto desconocido
    tpa: ip remoto,
    datlng: 26,
}

PAQUETE ARP REPLY
{
    htype: 1,
    ptype: '0800',
    operation: 'Replay',
    sha: ethernet local,
    spa: ip local,
    tha: ethernet remoto,
    tpa: ip remoto,
    datlng: 26,
};
*/

"use strict"

var MACs = (function(){
    var usadas = ['FF.FF.FF.FF.FF.FF'];
    function crear(){
        var hexa = '0123456789ABCDEF';
        var dir = "";
        var p;
        var i;
        p = Math.floor(Math.random() * 16);
        dir += hexa[p];
        p = Math.floor(Math.random() * 16);
        dir += hexa[p];
        for (i=0;i<5;i++){
            dir += '.';
            p = Math.floor(Math.random() * 16);
            dir += hexa[p];
            p = Math.floor(Math.random() * 16);
            dir += hexa[p];
        }
        return dir;
    }
    return {
        get: function(){
            var dir;
            do {
                dir = crear();
            } while(usadas.indexOf(dir)>=0);
            usadas.push(dir);
            return dir;
        },
    };
}());

function ARP(){
    var tabla = [];
    function buscarEther(ip){
        //busca en la tabla cual es la direccion ethernet de la ip dada
        //si no la encuentra en la tabla, retorna null
        var lng = tabla;
        var i;
        var ether = null;
        for(i=0;i<lng;i++){
            if (tabla[i].ip === ip){
                ether = tabla[i].ether;
                break;
            }
        }
        return ether;
    }
    function buscarPos(ip){
        //busca en la tabla cual es la posicion donde esta la ip dada
        var lng = tabla;
        var i;
        var pos = -1;
        for(i=0;i<lng;i++){
            if (tabla[i].ip === ip){
                pos = i;
                break;
            }
        }
        return pos;
    }
    this.getEther = function(ip,prt){
        //busca en la tabla la direccion ethernet de esa ip
        //prt, es el puerto por donde hará la consulta a la Red
        var ether = buscar(ip);
        if (ether === null){
            //Si no la encuentra, hace una solicitud ARP por la red
            //utilizando el puerto
            var arprqst = {
                htype: 1,
                ptype: '0800',
                operation: 'Request',
                sha: prt.direccion,
                spa: prt.ip,
                tha: '',
                tpa: ip,
                datlng: 26,
            };
            var frame = {
                origen: prt.direccion,
                destino: 'FF.FF.FF.FF.FF.FF',
                ethertype: '0806',
                payload: arprqst,
                datlng: arprqst.datlng + 18,
            };
            prt.send(frame);
        }
        return ether;
    };
    this.push = function(arprqst,prt){
        //Demonio que maneja las solicitudes de ARP remoto
        var pos = buscarPos(arprqst.spa);
        //aprende la pareja ip/ether del que pregunta
        if (pos>=0){
            //si existe, actualiza  la tabla
            tabla[pos].ether = arprqst.sha;
        } else {
            //si no existe, agrega a la tabla
            var obj = {
                ip: arprqst.spa,
                ether: arprqst.sha,
            };
            tabla.push(obj);
        }
    
        //responde, si es esta ip local y es Request
        if (arprqst.tpa === prt.ip && arprqst.operation === "Request"){
            var arprply = {
                htype: 1,
                ptype: '0800',
                operation: 'Replay',
                sha: prt.direccion,
                spa: prt.ip,
                tha: arprqst.sha,
                tpa: arprqst.spa,
                datlng: 26,
            };
            var frame = {
                origen: prt.direccion,
                destino: arprqst.sha,
                ethertype: '0806',
                payload: arprply,
                datlng: arprply.datlng + 18,
            };
            prt.send(frame);
        }
    }
}

function PuertoOut(){
    var velocidad = 16000; //bytes por segundo
    var tamano = 10000; //del buffer en bytes
    var equipo = null; //al que esta conectado al otro extremo
    var ptodst = 0; //al puerto fisico que esta conectado al otro extremo
    var cola = [];
    var trafico = 0; // contador trafico que logro traficar
  
    function longitudCola(){
        var lng = cola.length;
        var tam = 0;
        var i;
        for (i=0;i<lng;i++){
            tam += cola[i].datlng;
        }
        return tam;
    }
  
    function enviar(){
        var pqt = cola[0];
        trafico += pqt.datlng;
        equipo.push(pqt,ptodst);
        cola.shift();
        if (cola.length>0){
            setTimeout(enviar,1000*cola[0].datlng/velocidad);
        }
    }
    
    this.setVelocidad = function(vel){
        velocidad = vel / 8;
    };
    
    this.setBuffer = function(lngbuf){
        tamano = lngbuf;
    };
    
    this.conectar = function(equ,ptdes){
        equipo = equ;
        ptodst = ptdes;
    };
  
    this.encolar = function(pqt){
        if (equipo === null){
            return false;
        }
        var tam = longitudCola();
        if (tam + pqt.datlng <= tamano){
            //la cola no esta llena
            cola.push(pqt);
            if (cola.length==1){
                setTimeout(enviar,1000*pqt.datlng/velocidad);
            }
            return true;
        } else {
            return false;
        }
    };
  
    this.getStat = function(){
        return {
            trafico: trafico,
            cola: longitudCola(),
        };
    };
}

function PuertoEthernet(cb){
    PuertoOut.call(this);
    var self = this;
    var direccion = MACs.get();
    var callback = cb;
    this.recibir = function(frame){
        callback(frame,self);
    };
}

function PC(tam){
    // tam del buffer de salida
    var puerto = new PuertoEthernet(servicio);
    puerto.setVelocidad(10000000);
    var pings = [];
    var arpmanager = new ARP();

    function icmpmanager(pqt,prt){
        var trama = JSON.parse(pqt.payload);
        if (trama.type==='Request'){
            var icmp = {
                type:'Replay',
                timestamp:trama.timestamp,
                tamanho:trama.tamanho,
            };
            var paqueteip = {
                origen:puerto.ip,
                destino:pqt.origen,
                protocolo:'ICMP',
                payload:JSON.stringify(icmp),
                tamanho:icmp.tamanho+20,
            };
            enviar(paqueteip);
        } else {//Replay
            var ahora = Date.now();
            console.log("PC="+puerto.ip+". From "+pqt.origen+"; " +trama.tamanho+" bytes; time="+Math.floor(ahora-trama.timestamp) +' ms');
        }
    }
  
    function ipmanager(pqt,prt){
        if (pqt.destino!==prt.ip){
            return;
        }
        switch(pqt.protocolo){
            case 'ICMP':
                icmpmanager(pqt,prt);
                break;
        }
    }

    function enviar(paquete){
        var i,otroip;
        var ipdest = paquete.destino;
        if (enmired(ipdest,puerto)){
            otroip = ipdest;
        } else {
            otroip = puerto.nexthop;
        }
        var macdest = arpmanager.getEther(otroip,puerto);
        if (macdest!==null){
            var frame = {
                destino:macdest,
                origen:puerto.direccion,
                ethertype:'0800',
                payload:JSON.stringify(paquete),
                tamanho:paquete.tamanho+18,
            };
            puerto.send(frame);
        }
    }

    function enmired(dir,prto){
        var vdir = dir.split('.');
        var vmip = prto.ip.split('.');
        var vmsk = prto.mascara.split('.');
        var res1,res2;
        var i;
        var res = true;
        for (i=0;i<4;i++){
            res1 = parseInt(vdir[i],10) & parseInt(vmsk[i],10);
            res2 = parseInt(vmip[i],10) & parseInt(vmsk[i],10);
            if (res1!==res2){
                res = false;
                break;
            }
        }
        return res;
    }
  
    this.setPuerto = function(dirip,mskip,gtwip){
        puerto.ip = dirip;
        puerto.mascara = mskip;
        puerto.nexthop = gtwip;
    };
  
    this.ping = function(ipdest,tam){
        var ref = setInterval(function(){
            var icmp = {
                type:'Request',
                timestamp:Date.now(),
                datlng:tam+8,
            };
            var paqueteip = {
                origen:puerto.ip,
                destino:ipdest,
                protocolo:'ICMP',
                payload:icmp,
                datlng:icmp.datlng+20,
            };
            enviar(paqueteip);
        },1000);
        pings.push(ref);
    }
  
    this.stoping = function(){
        var lng = pings.length;
        var i;
        for (i=0;i<lng;i++){
            clearInterval(pings[i]);
        }
        pings = [];
    };
  
    this.getPuerto = function(){
        return puerto;
    };
  
    function servicio(frame,pto){
        if (frame.destino === pto.direccion || frame.destino === 'FF.FF.FF.FF.FF.FF'){
            switch(frame.ethertype){
                case '0800'://IP
                    ipmanager(frame.payload,pto);
                    break;
                case '0806'://ARP
                    arpmanager.push(JSON.parse(frame.payload),pto);
                    break;
            }
        }
    };
}


