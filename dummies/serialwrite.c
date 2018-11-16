#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <termios.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
int j=0;
 void main()
 {
    for(j=0;j<100;j++){
       //sleep(1);
        system("echo \"11,valve,12,123\" > /dev/pts/10"); 
    }
    
 }