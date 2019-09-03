/*Tipos de paquetes
TRAMA ETHERNET
{
    datlng:234 //tamaño total de la trama
}
*/

var GetMAC = (function(){
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
    function get(){
        var dir;
        do{
            dir = crear();
        } while(usadas.indexOf(dir)>=0);
        usadas.push(dir);
        return dir;
    }
    return get;
}());


function PuertoOut(vel,tam){
  var velocidad = vel/8; //bytes por segundo
  var tamano = tam; //del buffer en bytes
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
  }
}

