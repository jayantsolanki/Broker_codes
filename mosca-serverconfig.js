var mosca = require('mosca');

var opt = {
    port : 1883,
    backend : {
        type : 'mysql',
        host : '127.0.0.1',
        port : 3306,
        return_buffers: true
    },
    persistence : {
        factory     : mosca.persistence.Mysql,
        host        : '127.0.0.1',
        port        : 3306
    },
    http : {
        port : 3000,
        static : './static/'
    }
};
var server = new mosca.Server(opt, function(){
    console.log('server is ready!');

});