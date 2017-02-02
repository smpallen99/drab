(function(){
  function uuid() {
    // borrowed from http://stackoverflow.com/questions/105034/create-guid-uuid-in-javascript
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = (d + Math.random()*16)%16 | 0
      d = Math.floor(d/16)
      return (c=='x' ? r : (r&0x3|0x8)).toString(16)
    })
    return uuid
  }
  
  window.Drab = {
    run: function(drab_return_token, drab_store_token) {
      this.Socket = require("phoenix").Socket

      this.drab_return_token = drab_return_token
      this.drab_store_token = drab_store_token
      this.self = this
      this.myid = uuid()
      this.onload_launched = false
      this.already_connected = false
      this.path = location.pathname

      var drab = this

      // launch all on_load functions
      // for(var f of this.load) {
      //   f(this)
      // }
      drab.load.forEach(function(fx) {
        fx(drab)
      })

      var socket = new this.Socket("<%= Drab.config.socket %>", {params: {drab_return: drab_return_token}})
      socket.connect()
      this.channel = socket.channel("drab:" + this.path, {})
      
      this.channel.join()
        .receive("error", function(resp) { 
          // TODO: communicate it to user 
          console.log("Unable to join the Drab Channel", resp) 
        })
        .receive("ok", function(resp) {
          // launch on_connect
          // for(var f of drab.connected) {
          //   f(resp, drab)
          // }
          drab.connected.forEach(function(fx) {
            fx(resp, drab)
          })
          drab.already_connected = true
          // event is sent after Drab finish processing the event
          drab.channel.on("event", function (message) {
            // console.log("EVENT: ", message)
            if(drab.event_reply_table[message.finished]) {
              drab.event_reply_table[message.finished]()
              delete drab.event_reply_table[message.finished]
            }
            // update the store
            drab.drab_store_token = message.drab_store_token
          })
        })
      // socket.onError(function(ev) {console.log("SOCKET ERROR", ev);});
      // socket.onClose(function(ev) {console.log("SOCKET CLOSE", ev);});
      socket.onClose(function(event) {
        // on_disconnect
        // for(var f of drab.disconnected) {
          // f(drab)
        // }
        drab.disconnected.forEach(function(fx) {
          fx(drab)
        })
      })
    },
    // 
    //   string - event name
    //   event_handler -  string - function name in Phoenix Commander
    //   payload: object - will be passed as the second argument to the Event Handler
    //   execute_after - callback to function executes after event finish
    launch_event: function(event_name, event_handler, payload, execute_after) {
      var reply_to = uuid()
      if(execute_after) {
        Drab.event_reply_table[reply_to] = execute_after
      }
      var message = {
                      event: event_name, 
                      event_handler_function: event_handler, 
                      payload: payload, 
                      reply_to: reply_to,
                      drab_store_token: Drab.drab_store_token
                    }
      this.channel.push("event", message)
    },
    connected: [],
    disconnected: [],
    load: [],
    event_reply_table: {},
    on_connect: function(f) {
      this.connected.push(f)
    },
    on_disconnect: function(f) {
      this.disconnected.push(f)
    },
    on_load: function(f) {
      this.load.push(f)
    }
  }

  <%= 
    Enum.map(templates, fn template -> 
      Drab.Template.render_template(template, [])
    end)
  %>

  Drab.run('<%= controller_and_action %>', '<%= drab_store_token %>')
})();
