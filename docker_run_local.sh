docker rm -f touchresume

docker rmi twwch/touchresume:latest

docker run -d --name touchresume --platform linux/amd64 -p 3003:3000 -e AUTH_SECRET=l/UrZGNHj5a7EK4Uw6zu8/sBWxkRE6RcGRweGAX1Z5U= -v ./touchresume-data:/app/data twwch/touchresume:latest