global.databaseUri = 'mongodb://localhost/sup-dev';

var chai = require('chai');
var chaiHttp = require('chai-http');
var spies = require('chai-spies');
var mongoose = require('mongoose');
var UrlPattern = require('url-pattern');
var shared = require('./shared');
var app = require('../index');
var bcrypt = require('bcrypt');
var mongoose = require('mongoose');
var User = require('../models/user');
var passport = require ('passport');
var BasicStrategy = require('passport-http').BasicStrategy;

var should = chai.should();

chai.use(chaiHttp);
chai.use(spies);
// chai.use(bcrypt);

describe('User endpoints', function() {
    beforeEach(function() {
        mongoose.connection.db.dropDatabase();
    });
    describe('/users', function() {
        beforeEach(function() {
            this.pattern = new UrlPattern('/users');
        });

        describe('GET', function() {
            it('should return an empty list of users initially', function() {
                return chai.request(app)
                .get(this.pattern.stringify())
                .then(function(res) {
                    res.should.have.status(200);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.body.should.be.an('array');
                    res.body.length.should.equal(0);
                });
            });

            it('should return a list of users', function() {
                var user = {
                    username: 'joe',
                    password: 'password'
                };
                return chai.request(app)
                .post(this.pattern.stringify())
                .send(user)
                .then(function(res) {
                    return chai.request(app)
                    .get(this.pattern.stringify());
                }.bind(this))
                .then(function(res) {
                    res.should.have.status(200);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.body.should.be.an('array');
                    res.body.length.should.equal(1);
                    res.body[0].should.be.an('object');
                    res.body[0].should.have.property('username');
                    res.body[0].username.should.be.a('string');
                    res.body[0].username.should.equal(user.username);
                    res.body[0].should.have.property('_id');
                    res.body[0]._id.should.be.a('string');
                });

            });
        });
        describe('POST', function() {
            it('should allow adding a user', function() {
                var user = {
                    username: 'joe',
                    password: 'password'
                };
                return chai.request(app)
                .post(this.pattern.stringify())
                .send(user)
                .then(function(res) {
                    res.should.have.status(201);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.should.have.header('location');
                    res.body.should.be.an('object');
                    res.body.should.be.empty;

                    return chai.request(app)
                    .get(res.headers.location);
                })
                .then(function(res) {
                    res.body.should.be.an('object');
                    res.body.should.have.property('username');
                    res.body.username.should.be.a('string');
                    res.body.username.should.equal(user.username);
                    res.body.should.have.property('_id');
                    res.body._id.should.be.a('string');
                });
            });
            it('should reject users without a username', function() {
                var user = {};
                var spy = chai.spy();
                return chai.request(app)
                .post(this.pattern.stringify())
                .send(user)
                .then(spy)
                .then(function() {
                    spy.should.not.have.been.called();
                })
                .catch(function(err) {
                    var res = err.response;
                    res.should.have.status(422);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.body.should.be.an('object');
                    res.body.should.have.property('message');
                    res.body.message.should.equal('Missing field: username');
                });
            });
            it('should reject non-string usernames', function() {
                var user = {
                    username: 42,
                    password: 'password'
                };
                var spy = chai.spy();
                return chai.request(app)
                .post(this.pattern.stringify())
                .send(user)
                .then(spy)
                .then(function() {
                    spy.should.not.have.been.called();
                })
                .catch(function(err) {
                    var res = err.response;
                    res.should.have.status(422);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.body.should.be.an('object');
                    res.body.should.have.property('message');
                    res.body.message.should.equal('Incorrect field type: username');
                });
            });
            it('should hash a password', function(){
                var user = {
                    username: 'joe',
                    password: 'password'
                };
                return chai.request(app)
                .post(this.pattern.stringify())
                .send(user)
                .then(function(res) {
                    res.should.have.status(201);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.should.have.header('location');
                    res.body.should.be.an('object');
                    res.body.should.be.empty;

                    return chai.request(app)
                    .get(res.headers.location);
                })
                .then(function(res) {
                    res.body.should.be.an('object');
                    res.body.should.have.property('password');
                    res.body.password.should.be.a('string');
                    res.body.password.should.not.equal(user.password);
                });
            });
        });
    });

    describe('/users/:userId', function() {
        beforeEach(function() {
            this.pattern = new UrlPattern('/users/:userId');
        });

        describe('GET', function() {
            it('should 404 on non-existent users', function() {
                var spy = chai.spy();
                return chai.request(app)
                .get(this.pattern.stringify({userId: '000000000000000000000000'}))
                .then(spy)
                .then(function() {
                    spy.should.not.have.been.called();
                })
                .catch(function(err) {
                    var res = err.response;
                    res.should.have.status(404);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.body.should.be.an('object');
                    res.body.should.have.property('message');
                    res.body.message.should.equal('User not found');
                });
            });

            it('should return a single user', function() {
                var user = {
                    username: 'joe',
                    password: 'password'
                };
                var params;
                return chai.request(app)
                .post('/users')
                .send(user)
                .then(function(res) {
                    params = this.pattern.match(res.headers.location);
                    return chai.request(app)
                    .get(this.pattern.stringify({
                        userId: params.userId
                    }));
                }.bind(this))
                .then(function(res) {
                    res.should.have.status(200);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.body.should.be.an('object');
                    res.body.should.have.property('username');
                    res.body.username.should.be.a('string');
                    res.body.username.should.equal(user.username);
                    res.body.should.have.property('_id');
                    res.body._id.should.be.a('string');
                    res.body._id.should.equal(params.userId);
                });
            });
            it('should allow authenticated users to see hidden pages', function(){
                var user = {
                    username: 'joe',
                    password: 'password'
                };
                return chai.request(app)
                .post('/users')
                .send(user)
                .then(function(res){
                    return chai.request(app)
                    .get('/hidden')
                    .auth(user.username, user.password)
                    .then(function(res){
                        res.should.have.status(200);
                    });
                });
            });
            it('should keep unauthenticated users out of hidden pages', function(){
                var user = {
                    username: 'joe',
                    password: 'password'
                };
                return chai.request(app)
                .post('/users')
                .send(user)
                .then(function(res){
                    return chai.request(app)
                    .get('/hidden')
                    .catch(function(err){
                        var res = err.response;
                        res.should.have.status(401);
                    });
                });
            });
            it('should keep improperly authenticated users out of hidden pages', function(){
                var user = {
                    username: 'joe',
                    password: 'password'
                };
                return chai.request(app)
                .post('/users')
                .send(user)
                .then(function(res){
                    return chai.request(app)
                    .get('/hidden')
                    .auth('joe', 'password1')
                    .catch(function(err){
                        var res = err.response;
                        res.should.have.status(401);
                    });
                });
            });
        });

            // it('should allow editing a user', function() {
            //
            //     var user = new User({
            //         username: 'joe',
            //         password: 'password'
            //     });
            //     var newUserName = 'Aric';
            //
            //     return user.save(function(err){
            //         if (err) {
            //             console.log('error');
            //         }
            //         return chai.request(app)
            //         .put('/users/' +user._id).send(newUserName)
            //        .then(function(res) {
            //            console.log('old: ',user);
            //         //    res.should.have.status(200);
            //         //    res.type.should.equal('application/json');
            //         //    res.charset.should.equal('utf-8');
            //         //    res.body.should.be.an('string');
            //         //    res.body.should.be.empty
            //         //    //: use Mongoose to test that the username has been changed correctly
            //        });
            //     });
            // });
            describe.only('PUT', function() {
            it('should reject users without a username', function() {
                var user = {
                    _id: '000000000000000000000000'
                };
                var spy = chai.spy();
                return chai.request(app)
                .put(this.pattern.stringify({
                    userId: user._id
                }))
                .send(user)
                .then(spy)
                .then(function() {
                    spy.should.not.have.been.called();
                })
                .catch(function(err) {
                    var res = err.response;
                    res.should.have.status(422);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.body.should.be.an('object');
                    res.body.should.have.property('message');
                    res.body.message.should.equal('Missing field: username');
                });
            });
            it('should reject non-string usernames', function() {
                var user = {
                    _id: '000000000000000000000000',
                    username: 42,
                    password: 'password'
                };
                var spy = chai.spy();
                return chai.request(app)
                .put(this.pattern.stringify({
                    userId: user._id
                }))
                .send(user)
                .then(spy)
                .then(function() {
                    spy.should.not.have.been.called();
                })
                .catch(function(err) {
                    var res = err.response;
                    res.should.have.status(422);
                    res.type.should.equal('application/json');
                    res.charset.should.equal('utf-8');
                    res.body.should.be.an('object');
                    res.body.should.have.property('message');
                    res.body.message.should.equal('Incorrect field type: username');
                });
            });

        });
    });





    describe('DELETE', function() {
        it('should 404 on non-existent users', function() {
            var spy = chai.spy();
            return chai.request(app)
            .delete(this.pattern.stringify({userId: '000000000000000000000000'}))
            .then(spy)
            .then(function() {
                spy.should.not.have.been.called();
            })
            .catch(function(err) {
                var res = err.response;
                res.should.have.status(404);
                res.type.should.equal('application/json');
                res.charset.should.equal('utf-8');
                res.body.should.be.an('object');
                res.body.should.have.property('message');
                res.body.message.should.equal('User not found');
            });
        });
        it('should delete a user', function() {
            var user = {
                username: 'joe',
                password: 'password'
            };
            var params;
            return chai.request(app)
            .post('/users')
            .send(user)
            .then(function(res) {
                params = this.pattern.match(res.headers.location);
                return chai.request(app)
                .delete(this.pattern.stringify({
                    userId: params.userId
                }));
            }.bind(this))
            .then(function(res) {
                res.should.have.status(200);
                res.type.should.equal('application/json');
                res.charset.should.equal('utf-8');
                res.body.should.be.an('object');
                res.body.should.be.empty;
                var spy = chai.spy();
                return chai.request(app)
                .get(this.pattern.stringify({
                    userId: params.userId
                }))
                .then(spy)
                .then(function() {
                    spy.should.not.have.been.called();
                })
                .catch(function(err) {
                    var res = err.response;
                    res.should.have.status(404);
                });
            }.bind(this));
        });
    });
});
